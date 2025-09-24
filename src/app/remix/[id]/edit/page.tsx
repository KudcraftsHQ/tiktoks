'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Eye,
  Image as ImageIcon,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Bold,
  Italic,
  Underline,
  Settings,
  Palette,
  Download
} from 'lucide-react'
import { DraggableTextBox } from '@/components/DraggableTextBox'
import { DraggableBackgroundImage } from '@/components/DraggableBackgroundImage'
import { ImageSelectionDialog } from '@/components/ImageSelectionDialog'
import { SortableThumbnail } from '@/components/SortableThumbnail'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { cacheAssetService } from '@/lib/cache-asset-service'

// Adapt interfaces for remix structure
interface RemixTextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  color: string
  textAlign: string
  zIndex: number
  textStroke?: string
  textShadow?: string
  borderWidth?: number
  borderColor?: string
}

interface RemixSlide {
  id: string
  originalImageId?: string | null
  backgroundImageId?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
  displayOrder: number
  textBoxes: RemixTextBox[]
}

interface RemixPost {
  id: string
  name: string
  description?: string | null
  generationType: string
  slides: RemixSlide[]
  originalPost: {
    id: string
    tiktokUrl: string
    authorNickname?: string
    authorHandle?: string
    description?: string
    images: Array<{ cacheAssetId: string; width: number; height: number }>
  }
}

interface EditorProps {
  params: { id: string }
}

export default function RemixEditor({ params }: EditorProps) {
  const router = useRouter()
  const [remix, setRemix] = useState<RemixPost | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [thumbnailUpdateTrigger, setThumbnailUpdateTrigger] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [autoFitZoom, setAutoFitZoom] = useState(1)
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 })
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Original images for reference
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [isDragging, setIsDragging] = useState(false)

  React.useEffect(() => {
    if (isDragging) {
      const body = document.body
      const html = document.documentElement
      const thumbnailContainer = document.querySelector('.thumbnail-scroll-container') as HTMLElement
      const canvasArea = document.querySelector('.flex-1.flex.flex-col.relative') as HTMLElement

      const originalBodyOverflow = body.style.overflow
      const originalHtmlOverflow = html.style.overflow
      const originalThumbnailOverflow = thumbnailContainer?.style.overflowX

      body.style.overflow = 'hidden'
      html.style.overflow = 'hidden'
      body.classList.add('scroll-locked')

      if (thumbnailContainer) {
        thumbnailContainer.style.overflowX = 'hidden'
        thumbnailContainer.classList.add('thumbnail-container', 'dragging')
      }

      if (canvasArea) {
        canvasArea.style.overflow = 'hidden'
      }

      const preventTouch = (e: TouchEvent) => {
        if (e.touches.length > 1) return
        e.preventDefault()
      }

      document.addEventListener('touchmove', preventTouch, { passive: false })

      return () => {
        body.style.overflow = originalBodyOverflow || 'unset'
        html.style.overflow = originalHtmlOverflow || 'unset'
        body.classList.remove('scroll-locked')

        if (thumbnailContainer) {
          thumbnailContainer.style.overflowX = originalThumbnailOverflow || 'auto'
          thumbnailContainer.classList.remove('dragging')
        }

        if (canvasArea) {
          canvasArea.style.overflow = 'unset'
        }

        document.removeEventListener('touchmove', preventTouch)
      }
    }
  }, [isDragging])

  const fetchRemix = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/remixes/${params.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch remix')
      }
      const data = await response.json()
      setRemix(data)

      // Load original images for reference
      if (data.originalPost?.images?.length > 0) {
        const cacheAssetIds = data.originalPost.images.map((img: any) => img.cacheAssetId)
        const urls = await cacheAssetService.getUrls(cacheAssetIds)
        setOriginalImageUrls(urls)
      }
    } catch (error) {
      console.error('Failed to fetch remix:', error)
      setError('Failed to load remix')
    } finally {
      setIsLoading(false)
    }
  }

  const saveRemix = async (isAutoSave = false) => {
    if (!remix) return

    if (isAutoSave) {
      setIsAutoSaving(true)
    } else {
      setIsSaving(true)
    }

    try {
      const response = await fetch(`/api/remixes/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: remix.name,
          description: remix.description,
          slides: remix.slides.map(slide => ({
            id: slide.id,
            displayOrder: slide.displayOrder,
            originalImageId: slide.originalImageId,
            backgroundImageId: slide.backgroundImageId,
            backgroundImagePositionX: slide.backgroundImagePositionX,
            backgroundImagePositionY: slide.backgroundImagePositionY,
            backgroundImageZoom: slide.backgroundImageZoom,
            textBoxes: slide.textBoxes.map(textBox => ({
              id: textBox.id,
              text: textBox.text,
              x: textBox.x,
              y: textBox.y,
              width: textBox.width,
              height: textBox.height,
              fontSize: textBox.fontSize,
              fontFamily: textBox.fontFamily,
              fontWeight: textBox.fontWeight,
              fontStyle: textBox.fontStyle,
              textDecoration: textBox.textDecoration,
              color: textBox.color,
              textAlign: textBox.textAlign,
              zIndex: textBox.zIndex,
              textStroke: textBox.textStroke,
              textShadow: textBox.textShadow,
              borderWidth: textBox.borderWidth,
              borderColor: textBox.borderColor
            }))
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save remix')
      }

      if (isAutoSave) {
        setHasUnsavedChanges(false)
      }
      console.log(isAutoSave ? 'Auto-saved successfully' : 'Remix saved successfully')
    } catch (error) {
      console.error('Failed to save remix:', error)
      if (!isAutoSave) {
        setError('Failed to save changes')
      }
    } finally {
      if (isAutoSave) {
        setIsAutoSaving(false)
      } else {
        setIsSaving(false)
      }
    }
  }

  // Debounced auto-save function
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveRemix(true)
    }, 2000)
  }, [remix])

  // Mark changes as unsaved and trigger auto-save
  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true)
    triggerAutoSave()
  }, [triggerAutoSave])

  const addSlide = () => {
    if (!remix) return

    const newSlide: RemixSlide = {
      id: `temp-${Date.now()}`,
      originalImageId: null,
      backgroundImageId: null,
      backgroundImagePositionX: 0.5,
      backgroundImagePositionY: 0.5,
      backgroundImageZoom: 1.0,
      displayOrder: remix.slides.length,
      textBoxes: []
    }

    const newSlideIndex = remix.slides.length

    setRemix({
      ...remix,
      slides: [...remix.slides, newSlide]
    })

    setCurrentSlideIndex(newSlideIndex)
    markAsChanged()
  }

  const deleteSlide = (slideIndex: number) => {
    if (!remix || remix.slides.length <= 1) return

    const updatedSlides = remix.slides.filter((_, index) => index !== slideIndex)
    updatedSlides.forEach((slide, index) => {
      slide.displayOrder = index
    })

    setRemix({
      ...remix,
      slides: updatedSlides
    })

    if (currentSlideIndex >= updatedSlides.length) {
      setCurrentSlideIndex(updatedSlides.length - 1)
    }
    markAsChanged()
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setIsDragging(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setIsDragging(false)

    if (active.id !== over?.id && remix) {
      const oldIndex = remix.slides.findIndex(slide => slide.id === active.id)
      const newIndex = remix.slides.findIndex(slide => slide.id === over?.id)

      const updatedSlides = arrayMove(remix.slides, oldIndex, newIndex)

      updatedSlides.forEach((slide, index) => {
        slide.displayOrder = index
      })

      setRemix({
        ...remix,
        slides: updatedSlides
      })

      if (currentSlideIndex === oldIndex) {
        setCurrentSlideIndex(newIndex)
      } else if (currentSlideIndex > oldIndex && currentSlideIndex <= newIndex) {
        setCurrentSlideIndex(currentSlideIndex - 1)
      } else if (currentSlideIndex < oldIndex && currentSlideIndex >= newIndex) {
        setCurrentSlideIndex(currentSlideIndex + 1)
      }

      setThumbnailUpdateTrigger(prev => prev + 1)
      markAsChanged()
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setIsDragging(false)
  }

  const addTextBox = () => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const currentSlide = remix.slides[currentSlideIndex]
    const newTextBox: RemixTextBox = {
      id: `temp-${Date.now()}`,
      text: 'New text box',
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.2,
      fontSize: 24,
      fontFamily: 'Poppins',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#ffffff',
      textAlign: 'center',
      zIndex: 1,
      textStroke: undefined,
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
      borderWidth: 0,
      borderColor: '#000000'
    }

    const updatedSlides = [...remix.slides]
    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      textBoxes: [...currentSlide.textBoxes, newTextBox]
    }

    setRemix({
      ...remix,
      slides: updatedSlides
    })

    setSelectedTextBoxId(newTextBox.id)
    markAsChanged()
  }

  const updateTextBox = (textBoxId: string, updates: Partial<RemixTextBox>) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const updatedSlides = [...remix.slides]
    const currentSlide = updatedSlides[currentSlideIndex]

    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      textBoxes: currentSlide.textBoxes.map(textBox =>
        textBox.id === textBoxId ? { ...textBox, ...updates } : textBox
      )
    }

    setRemix({
      ...remix,
      slides: updatedSlides
    })

    setThumbnailUpdateTrigger(prev => prev + 1)
    markAsChanged()
  }

  const updateBackgroundImage = (updates: Partial<RemixSlide>) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const updatedSlides = [...remix.slides]
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      ...updates
    }

    setRemix({
      ...remix,
      slides: updatedSlides
    })

    setThumbnailUpdateTrigger(prev => prev + 1)
    markAsChanged()
  }

  // Page alignment functions (same as carousel editor)
  const alignTextBoxHorizontally = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedTextBoxId || !currentSlide) return

    let x = 0
    switch (alignment) {
      case 'left':
        x = 0
        break
      case 'center':
        const currentTextBox = currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId)
        if (currentTextBox) {
          x = 0.5 - (currentTextBox.width / 2)
        }
        break
      case 'right':
        const currentTextBoxRight = currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId)
        if (currentTextBoxRight) {
          x = 1 - currentTextBoxRight.width
        }
        break
    }
    updateTextBox(selectedTextBoxId, { x })
  }

  const alignTextBoxVertically = (alignment: 'top' | 'center' | 'bottom') => {
    if (!selectedTextBoxId || !currentSlide) return

    let y = 0
    switch (alignment) {
      case 'top':
        y = 0
        break
      case 'center':
        const currentTextBox = currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId)
        if (currentTextBox) {
          y = 0.5 - (currentTextBox.height / 2)
        }
        break
      case 'bottom':
        const currentTextBoxBottom = currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId)
        if (currentTextBoxBottom) {
          y = 1 - currentTextBoxBottom.height
        }
        break
    }
    updateTextBox(selectedTextBoxId, { y })
  }

  const deleteTextBox = (textBoxId: string) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const updatedSlides = [...remix.slides]
    const currentSlide = updatedSlides[currentSlideIndex]

    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      textBoxes: currentSlide.textBoxes.filter(textBox => textBox.id !== textBoxId)
    }

    setRemix({
      ...remix,
      slides: updatedSlides
    })

    if (selectedTextBoxId === textBoxId) {
      setSelectedTextBoxId(null)
    }
    markAsChanged()
  }

  const handleImageSelect = (imageUrl: string) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const updatedSlides = [...remix.slides]
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      backgroundImageId: imageUrl // This would need to be a cache asset ID in practice
    }

    setRemix({
      ...remix,
      slides: updatedSlides
    })
    markAsChanged()
  }

  const exportRemix = async () => {
    if (!remix) {
      console.error('No remix available for export')
      return
    }

    try {
      setError(null)
      setIsExporting(true)

      console.log(`📦 Starting export for remix: ${remix.id}`)

      const response = await fetch(`/api/remixes/${remix.id}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format: 'png',
          quality: 0.95
        })
      })

      if (!response.ok) {
        throw new Error('Export request failed')
      }

      // Get the blob from response
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${remix.name.replace(/[^a-zA-Z0-9]/g, '_')}-export.zip`

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the URL object
      window.URL.revokeObjectURL(url)

      console.log(`✅ Export successful for remix: ${remix.id}`)
    } catch (error) {
      console.error('Export failed:', error)
      setError('Failed to export remix. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Canvas zoom and pan (same as carousel editor)
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(canvasZoom * delta, 0.25), 3)
      setCanvasZoom(newZoom)
    }
  }, [canvasZoom])

  const calculateAutoFitZoom = useCallback(() => {
    if (!canvasContainerRef.current) return 1

    const container = canvasContainerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    const canvasWidth = 540
    const canvasHeight = 960
    const padding = 40

    const availableWidth = containerWidth - (padding * 2)
    const availableHeight = containerHeight - (padding * 2) - 160

    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight

    const scale = Math.min(scaleX, scaleY, 1)

    return Math.max(scale, 0.1)
  }, [])

  const resetZoom = useCallback(() => {
    setCanvasZoom(autoFitZoom)
    setCanvasPosition({ x: 0, y: 0 })
  }, [autoFitZoom])

  // Auto-fit zoom on mount and resize
  useEffect(() => {
    const updateAutoFit = () => {
      const newAutoFitZoom = calculateAutoFitZoom()
      setAutoFitZoom(newAutoFitZoom)
      setCanvasZoom(newAutoFitZoom)
    }

    setTimeout(updateAutoFit, 100)
    window.addEventListener('resize', updateAutoFit)
    return () => window.removeEventListener('resize', updateAutoFit)
  }, [calculateAutoFitZoom])

  useEffect(() => {
    fetchRemix()
  }, [params.id])

  useEffect(() => {
    if (remix && canvasContainerRef.current) {
      setTimeout(() => {
        const newAutoFitZoom = calculateAutoFitZoom()
        setAutoFitZoom(newAutoFitZoom)
        setCanvasZoom(newAutoFitZoom)
      }, 200)
    }
  }, [remix, calculateAutoFitZoom])

  // Handle unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span>Loading remix editor...</span>
        </div>
      </div>
    )
  }

  if (error || !remix) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Remix not found'}</p>
          <Button onClick={() => router.push(`/posts/${remix?.originalPost?.id}/remix`)} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Remix Studio
          </Button>
        </div>
      </div>
    )
  }

  const currentSlide = remix.slides[currentSlideIndex]
  const selectedTextBox = selectedTextBoxId
    ? currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId)
    : null

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b w-full">
        <div className="w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                if (hasUnsavedChanges) {
                  const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
                  if (confirmed) {
                    router.push(`/posts/${remix.originalPost.id}/remix`)
                  }
                } else {
                  router.push(`/posts/${remix.originalPost.id}/remix`)
                }
              }}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Remix Studio
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                Edit: {remix.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Remix of {remix.originalPost.authorNickname || remix.originalPost.authorHandle}'s content
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => saveRemix(false)}
                disabled={isSaving || isAutoSaving}
                variant={hasUnsavedChanges ? "default" : "outline"}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' :
                 isAutoSaving ? 'Auto-saving...' :
                 hasUnsavedChanges ? 'Save' : 'Saved'}
              </Button>
              {hasUnsavedChanges && (
                <span className="text-xs text-orange-600">Unsaved changes</span>
              )}
              {isAutoSaving && (
                <span className="text-xs text-blue-600">Auto-saving...</span>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Zoom: {Math.round(canvasZoom * 100)}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetZoom}
                  disabled={Math.abs(canvasZoom - autoFitZoom) < 0.01}
                  title="Fit to screen"
                >
                  Fit
                </Button>
              </div>
              <Button
                onClick={exportRemix}
                variant="outline"
                size="sm"
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Editor - Same structure as carousel editor but adapted for remix */}
      <div className="flex h-[calc(100vh-80px)] overflow-hidden">
        {/* Left Sidebar - Controls */}
        <div className="w-80 border-r bg-background p-4 space-y-4 overflow-y-auto">
          {/* Original Reference Images */}
          {originalImageUrls.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4 text-primary" />
                  Original Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {originalImageUrls.map((url, index) => (
                    <div key={index} className="flex-shrink-0">
                      <div className="w-16 h-24 bg-muted rounded overflow-hidden border">
                        {url ? (
                          <img
                            src={url}
                            alt={`Original ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-center mt-1 text-muted-foreground">
                        {index + 1}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rest of the sidebar content - same as carousel editor */}
          {/* Background Image Controls */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4 text-primary" />
                Background Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setShowImageDialog(true)}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Change Background
              </Button>

              {/* Background positioning controls would go here - same as carousel editor */}
            </CardContent>
          </Card>

          {/* Text Box Controls - same structure as carousel editor */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Type className="h-4 w-4 text-primary" />
                  Text Elements
                </CardTitle>
                {!selectedTextBox && (
                  <Button
                    onClick={addTextBox}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedTextBox ? (
                <div className="space-y-4">
                  {/* Text editing controls - same as carousel editor */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Text Content</label>
                    <Textarea
                      value={selectedTextBox.text}
                      onChange={(e) => updateTextBox(selectedTextBox.id, { text: e.target.value })}
                      rows={3}
                      className="resize-none"
                      placeholder="Enter your text..."
                    />
                  </div>

                  {/* Font size and color controls */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Font Size</label>
                      <Input
                        type="number"
                        min="12"
                        max="72"
                        value={selectedTextBox.fontSize}
                        onChange={(e) => updateTextBox(selectedTextBox.id, { fontSize: parseInt(e.target.value) })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedTextBox.color}
                          onChange={(e) => updateTextBox(selectedTextBox.id, { color: e.target.value })}
                          className="w-12 h-9 rounded-md border border-input cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={selectedTextBox.color}
                          onChange={(e) => updateTextBox(selectedTextBox.id, { color: e.target.value })}
                          className="flex-1 text-xs font-mono"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <Separator />
                  <Button
                    onClick={() => deleteTextBox(selectedTextBox.id)}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Text Box
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                    <Type className="h-8 w-8 opacity-50" />
                  </div>
                  {currentSlide?.textBoxes.length === 0 ? (
                    <div>
                      <p className="text-sm font-medium mb-1">No text boxes yet</p>
                      <p className="text-xs text-muted-foreground">Click "Add" to create your first text element</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium mb-1">Select a text box</p>
                      <p className="text-xs text-muted-foreground">Click on a text box in the canvas to edit it</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Canvas Area - Same as carousel editor but adapted for remix */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Canvas */}
            <div
              ref={canvasContainerRef}
              className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden"
              style={{ touchAction: 'none', paddingBottom: '160px' }}
              onWheel={handleWheel}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedTextBoxId(null)
                }
              }}
            >
              <div
                className="relative transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${canvasZoom}) translate(${canvasPosition.x}px, ${canvasPosition.y}px)`
                }}
              >
                <div
                  className="bg-white rounded-lg shadow-lg overflow-hidden relative"
                  style={{ width: 540, height: 960 }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target === e.currentTarget) {
                      setSelectedTextBoxId(null)
                      setSelectedBackgroundImage(false)
                    }
                  }}
                >
                  {/* Background Image */}
                  {currentSlide?.backgroundImageId || currentSlide?.originalImageId ? (
                    <DraggableBackgroundImage
                      slide={currentSlide}
                      isSelected={selectedBackgroundImage}
                      onSelect={() => {
                        setSelectedBackgroundImage(true)
                        setSelectedTextBoxId(null)
                      }}
                      onUpdate={updateBackgroundImage}
                      containerWidth={540}
                      containerHeight={960}
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center cursor-pointer hover:bg-gradient-to-br hover:from-gray-200 hover:to-gray-300 transition-colors"
                      onClick={() => setShowImageDialog(true)}
                    >
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Click to add background</p>
                      </div>
                    </div>
                  )}

                  {/* Text Boxes */}
                  {currentSlide?.textBoxes.map((textBox) => (
                    <DraggableTextBox
                      key={textBox.id}
                      textBox={textBox}
                      isSelected={selectedTextBoxId === textBox.id}
                      onSelect={() => {
                        setSelectedTextBoxId(textBox.id)
                        setSelectedBackgroundImage(false)
                      }}
                      onUpdate={(updates) => updateTextBox(textBox.id, updates)}
                      containerWidth={540}
                      containerHeight={960}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Thumbnail Bar */}
            <div className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm">
              <div className="p-4">
                <SortableContext
                  items={remix.slides.map(slide => slide.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className={`thumbnail-scroll-container flex gap-3 overflow-x-auto scrollbar-hide ${isDragging ? 'dragging' : ''}`}>
                    {remix.slides.map((slide, index) => (
                      <SortableThumbnail
                        key={`${slide.id}-${thumbnailUpdateTrigger}`}
                        slide={slide}
                        index={index}
                        isActive={index === currentSlideIndex}
                        onClick={() => setCurrentSlideIndex(index)}
                        onDelete={() => deleteSlide(index)}
                        canDelete={remix.slides.length > 1}
                      />
                    ))}

                    <button
                      onClick={addSlide}
                      className="flex-shrink-0 w-18 h-28 bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center hover:border-primary/60 hover:bg-muted/70 hover:scale-105 transition-all duration-300 cursor-pointer group"
                    >
                      <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors duration-200 mt-1 font-medium">Add Slide</span>
                    </button>
                  </div>
                </SortableContext>
              </div>
            </div>

            {/* DragOverlay */}
            <DragOverlay
              dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
              }}
              style={{
                cursor: 'grabbing',
                zIndex: 1000
              }}
            >
              {activeId ? (
                <div
                  className={`w-18 h-28 rounded-2xl border-3 border-primary/60 bg-white shadow-2xl pointer-events-none drag-overlay sortable-item ${isDragging ? 'animate-drag-float' : ''}`}
                  style={{
                    opacity: 0.9,
                    transform: 'rotate(3deg) scale(1.05)',
                    transformOrigin: 'center center',
                    filter: 'drop-shadow(0 25px 50px rgb(0 0 0 / 0.25))'
                  }}
                >
                  <div className="w-full h-full relative rounded-xl overflow-hidden bg-white/95 backdrop-blur-sm">
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center opacity-80">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="absolute inset-0 bg-primary/15 rounded-xl border-2 border-primary/40 backdrop-blur-[1px]" />
                    <div className="absolute inset-0 rounded-xl border-2 border-primary/60 animate-pulse" />
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      </div>

      {/* Image Selection Dialog */}
      <ImageSelectionDialog
        open={showImageDialog}
        onOpenChange={setShowImageDialog}
        onSelectImage={handleImageSelect}
      />
    </div>
  )
}