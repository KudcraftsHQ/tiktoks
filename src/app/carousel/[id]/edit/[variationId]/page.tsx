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
  Sliders
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

interface CarouselTextBox {
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

interface CarouselSlide {
  id: string
  backgroundImageUrl?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
  displayOrder: number
  textBoxes: CarouselTextBox[]
}

interface CarouselVariation {
  id: string
  name: string
  description?: string | null
  slides: CarouselSlide[]
}

interface EditorProps {
  params: { id: string; variationId: string }
}

export default function CarouselEditor({ params }: EditorProps) {
  const router = useRouter()
  const [variation, setVariation] = useState<CarouselVariation | null>(null)
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

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 150, // Press and hold for 150ms to start dragging
        tolerance: 5, // Allow 5px movement during press delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Prevent scrolling during drag
  const [isDragging, setIsDragging] = useState(false)
  
  React.useEffect(() => {
    if (isDragging) {
      // Comprehensive scroll prevention during drag
      const body = document.body
      const html = document.documentElement
      const thumbnailContainer = document.querySelector('.thumbnail-scroll-container') as HTMLElement
      const canvasArea = document.querySelector('.flex-1.flex.flex-col.relative') as HTMLElement
      
      // Store original styles
      const originalBodyOverflow = body.style.overflow
      const originalHtmlOverflow = html.style.overflow
      const originalThumbnailOverflow = thumbnailContainer?.style.overflowX
      
      // Apply scroll locks
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
      
      // Prevent touch scrolling
      const preventTouch = (e: TouchEvent) => {
        if (e.touches.length > 1) return
        e.preventDefault()
      }
      
      document.addEventListener('touchmove', preventTouch, { passive: false })
      
      // Cleanup function
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

  const fetchVariation = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/carousels/${params.id}/variations/${params.variationId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch variation')
      }
      const data = await response.json()
      setVariation(data)
    } catch (error) {
      console.error('Failed to fetch variation:', error)
      setError('Failed to load variation')
    } finally {
      setIsLoading(false)
    }
  }

  const saveVariation = async (isAutoSave = false) => {
    if (!variation) return
    
    if (isAutoSave) {
      setIsAutoSaving(true)
    } else {
      setIsSaving(true)
    }

    try {
      const response = await fetch(`/api/carousels/${params.id}/variations/${params.variationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: variation.name,
          description: variation.description,
          slides: variation.slides.map(slide => ({
            backgroundImageUrl: slide.backgroundImageUrl,
            backgroundImagePositionX: slide.backgroundImagePositionX,
            backgroundImagePositionY: slide.backgroundImagePositionY,
            backgroundImageZoom: slide.backgroundImageZoom,
            displayOrder: slide.displayOrder,
            textBoxes: slide.textBoxes.map(textBox => ({
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
        throw new Error('Failed to save variation')
      }

      if (isAutoSave) {
        setHasUnsavedChanges(false)
      }
      console.log(isAutoSave ? 'Auto-saved successfully' : 'Variation saved successfully')
    } catch (error) {
      console.error('Failed to save variation:', error)
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
      saveVariation(true)
    }, 2000) // Auto-save after 2 seconds of inactivity
  }, [variation])

  // Mark changes as unsaved and trigger auto-save
  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true)
    triggerAutoSave()
  }, [triggerAutoSave])

  const addSlide = () => {
    if (!variation) return

    const newSlide: CarouselSlide = {
      id: `temp-${Date.now()}`,
      backgroundImageUrl: null,
      backgroundImagePositionX: 0.5,
      backgroundImagePositionY: 0.5,
      backgroundImageZoom: 1.0,
      displayOrder: variation.slides.length,
      textBoxes: []
    }

    const newSlideIndex = variation.slides.length

    setVariation({
      ...variation,
      slides: [...variation.slides, newSlide]
    })

    // Automatically switch to the new slide
    setCurrentSlideIndex(newSlideIndex)
    markAsChanged()
  }

  const deleteSlide = (slideIndex: number) => {
    if (!variation || variation.slides.length <= 1) return

    const updatedSlides = variation.slides.filter((_, index) => index !== slideIndex)
    // Reorder display orders
    updatedSlides.forEach((slide, index) => {
      slide.displayOrder = index
    })

    setVariation({
      ...variation,
      slides: updatedSlides
    })

    // Adjust current slide index if needed
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

    if (active.id !== over?.id && variation) {
      const oldIndex = variation.slides.findIndex(slide => slide.id === active.id)
      const newIndex = variation.slides.findIndex(slide => slide.id === over?.id)

      const updatedSlides = arrayMove(variation.slides, oldIndex, newIndex)
      
      // Update display orders
      updatedSlides.forEach((slide, index) => {
        slide.displayOrder = index
      })

      setVariation({
        ...variation,
        slides: updatedSlides
      })

      // Update current slide index if needed
      if (currentSlideIndex === oldIndex) {
        setCurrentSlideIndex(newIndex)
      } else if (currentSlideIndex > oldIndex && currentSlideIndex <= newIndex) {
        setCurrentSlideIndex(currentSlideIndex - 1)
      } else if (currentSlideIndex < oldIndex && currentSlideIndex >= newIndex) {
        setCurrentSlideIndex(currentSlideIndex + 1)
      }

      // Trigger thumbnail update
      setThumbnailUpdateTrigger(prev => prev + 1)
      markAsChanged()
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setIsDragging(false)
  }

  const addTextBox = () => {
    if (!variation || currentSlideIndex >= variation.slides.length) return

    const currentSlide = variation.slides[currentSlideIndex]
    const newTextBox: CarouselTextBox = {
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
      color: '#000000',
      textAlign: 'center',
      zIndex: 1,
      textStroke: undefined,
      textShadow: undefined,
      borderWidth: 0,
      borderColor: '#000000'
    }

    const updatedSlides = [...variation.slides]
    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      textBoxes: [...currentSlide.textBoxes, newTextBox]
    }

    setVariation({
      ...variation,
      slides: updatedSlides
    })

    setSelectedTextBoxId(newTextBox.id)
    markAsChanged()
  }

  const updateTextBox = (textBoxId: string, updates: Partial<CarouselTextBox>) => {
    if (!variation || currentSlideIndex >= variation.slides.length) return

    const updatedSlides = [...variation.slides]
    const currentSlide = updatedSlides[currentSlideIndex]
    
    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      textBoxes: currentSlide.textBoxes.map(textBox =>
        textBox.id === textBoxId ? { ...textBox, ...updates } : textBox
      )
    }

    setVariation({
      ...variation,
      slides: updatedSlides
    })
    
    // Trigger thumbnail update
    setThumbnailUpdateTrigger(prev => prev + 1)
    markAsChanged()
  }

  const updateBackgroundImage = (updates: Partial<CarouselSlide>) => {
    if (!variation || currentSlideIndex >= variation.slides.length) return

    const updatedSlides = [...variation.slides]
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      ...updates
    }

    setVariation({
      ...variation,
      slides: updatedSlides
    })
    
    // Trigger thumbnail update
    setThumbnailUpdateTrigger(prev => prev + 1)
    markAsChanged()
  }

  // Page alignment functions
  const alignTextBoxHorizontally = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedTextBoxId) return

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
    if (!selectedTextBoxId) return

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
    if (!variation || currentSlideIndex >= variation.slides.length) return

    const updatedSlides = [...variation.slides]
    const currentSlide = updatedSlides[currentSlideIndex]
    
    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      textBoxes: currentSlide.textBoxes.filter(textBox => textBox.id !== textBoxId)
    }

    setVariation({
      ...variation,
      slides: updatedSlides
    })

    if (selectedTextBoxId === textBoxId) {
      setSelectedTextBoxId(null)
    }
    markAsChanged()
  }

  const handleImageSelect = (imageUrl: string) => {
    if (!variation || currentSlideIndex >= variation.slides.length) return

    const updatedSlides = [...variation.slides]
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      backgroundImageUrl: imageUrl
    }

    setVariation({
      ...variation,
      slides: updatedSlides
    })
    markAsChanged()
  }

  const exportCurrentSlide = async () => {
    if (!variation || !currentSlide) {
      console.error('Variation or current slide not available')
      return
    }

    try {
      setError(null) // Clear any previous errors
      setIsExporting(true)
      
      // Call backend export API
      const response = await fetch(`/api/carousels/${params.id}/variations/${params.variationId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slideIndex: currentSlideIndex,
          format: 'png',
          quality: 0.95
        }),
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
      link.download = `${variation.name.replace(/[^a-zA-Z0-9]/g, '_')}-slide-${currentSlideIndex + 1}.png`
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the URL object
      window.URL.revokeObjectURL(url)
      
      console.log('Export successful')
    } catch (error) {
      console.error('Export failed:', error)
      setError('Failed to export slide. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Canvas zoom and pan functionality
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(canvasZoom * delta, 0.25), 3)
      setCanvasZoom(newZoom)
    }
  }, [canvasZoom])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      setLastPinchDistance(distance)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance) {
      e.preventDefault()
      e.stopPropagation()
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      const scale = distance / lastPinchDistance
      const newZoom = Math.min(Math.max(canvasZoom * scale, 0.25), 3)
      setCanvasZoom(newZoom)
      setLastPinchDistance(distance)
    }
  }, [canvasZoom, lastPinchDistance])

  const handleTouchEnd = useCallback(() => {
    setLastPinchDistance(null)
  }, [])

  // Calculate auto-fit zoom based on container size
  const calculateAutoFitZoom = useCallback(() => {
    if (!canvasContainerRef.current) return 1
    
    const container = canvasContainerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    
    // Canvas size (540x960) with padding
    const canvasWidth = 540
    const canvasHeight = 960
    const padding = 40 // 40px padding on all sides
    
    // Calculate available space
    const availableWidth = containerWidth - (padding * 2)
    const availableHeight = containerHeight - (padding * 2) - 160 // Account for thumbnail area at bottom
    
    // Calculate scale to fit both dimensions
    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight
    
    // Use the smaller scale to ensure both dimensions fit
    const scale = Math.min(scaleX, scaleY, 1) // Cap at 1 to avoid upscaling beyond original size
    
    return Math.max(scale, 0.1) // Minimum 10% zoom
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
      setCanvasZoom(newAutoFitZoom) // Set initial zoom to auto-fit
    }

    // Initial calculation
    setTimeout(updateAutoFit, 100) // Small delay to ensure container is rendered

    // Update on window resize
    window.addEventListener('resize', updateAutoFit)
    return () => window.removeEventListener('resize', updateAutoFit)
  }, [calculateAutoFitZoom])

  useEffect(() => {
    fetchVariation()
  }, [params.id, params.variationId])

  // Recalculate auto-fit when variation loads
  useEffect(() => {
    if (variation && canvasContainerRef.current) {
      setTimeout(() => {
        const newAutoFitZoom = calculateAutoFitZoom()
        setAutoFitZoom(newAutoFitZoom)
        setCanvasZoom(newAutoFitZoom)
      }, 200)
    }
  }, [variation, calculateAutoFitZoom])

  // Prevent default browser zoom behaviors
  useEffect(() => {
    const preventDefaultTouchBehavior = (e: TouchEvent) => {
      // Only prevent if it's a multi-touch gesture
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    const preventDefaultWheelBehavior = (e: WheelEvent) => {
      // Only prevent if it's a zoom gesture (Ctrl/Cmd + wheel)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    // Add event listeners with passive: false to allow preventDefault
    document.addEventListener('touchmove', preventDefaultTouchBehavior, { passive: false })
    document.addEventListener('wheel', preventDefaultWheelBehavior, { passive: false })

    return () => {
      document.removeEventListener('touchmove', preventDefaultTouchBehavior)
      document.removeEventListener('wheel', preventDefaultWheelBehavior)
    }
  }, [])

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

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // Clean up auto-save timeout on unmount
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
          <span>Loading editor...</span>
        </div>
      </div>
    )
  }

  if (error || !variation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Variation not found'}</p>
          <Button onClick={() => router.push(`/carousel/${params.id}`)} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Hub
          </Button>
        </div>
      </div>
    )
  }

  const currentSlide = variation.slides[currentSlideIndex]
  const selectedTextBox = selectedTextBoxId 
    ? currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId)
    : null

  return (
    <div className="h-screen bg-background overflow-hidden">
        {/* Header - Full Width */}
        <header className="border-b w-full">
          <div className="w-full px-6 py-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => {
                  if (hasUnsavedChanges) {
                    const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
                    if (confirmed) {
                      router.push(`/carousel/${params.id}`)
                    }
                  } else {
                    router.push(`/carousel/${params.id}`)
                  }
                }} 
                variant="ghost" 
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Hub
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold">
                  Design: {variation.name}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => saveVariation(false)}
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
                  variant="outline" 
                  size="sm"
                  onClick={exportCurrentSlide}
                  disabled={isExporting}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Editor */}
        <div className="flex h-[calc(100vh-80px)] overflow-hidden">
          {/* Left Secondary Sidebar - Background & Text Settings */}
          <div className="w-80 border-r bg-background p-4 space-y-4 overflow-y-auto">
            {/* Background Image Controls - Always Show */}
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
                  Change Image
                </Button>
                
                {currentSlide?.backgroundImageUrl && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-muted-foreground">Horizontal Position</label>
                          <span className="text-xs text-muted-foreground">{Math.round(currentSlide.backgroundImagePositionX * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={currentSlide.backgroundImagePositionX}
                          onChange={(e) => {
                            const updatedSlides = [...variation.slides]
                            updatedSlides[currentSlideIndex] = {
                              ...currentSlide,
                              backgroundImagePositionX: parseFloat(e.target.value)
                            }
                            setVariation({ ...variation, slides: updatedSlides })
                          }}
                          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-muted-foreground">Vertical Position</label>
                          <span className="text-xs text-muted-foreground">{Math.round(currentSlide.backgroundImagePositionY * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={currentSlide.backgroundImagePositionY}
                          onChange={(e) => {
                            const updatedSlides = [...variation.slides]
                            updatedSlides[currentSlideIndex] = {
                              ...currentSlide,
                              backgroundImagePositionY: parseFloat(e.target.value)
                            }
                            setVariation({ ...variation, slides: updatedSlides })
                          }}
                          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-muted-foreground">Zoom Level</label>
                          <span className="text-xs text-muted-foreground">{Math.round(currentSlide.backgroundImageZoom * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={currentSlide.backgroundImageZoom}
                          onChange={(e) => {
                            const updatedSlides = [...variation.slides]
                            updatedSlides[currentSlideIndex] = {
                              ...currentSlide,
                              backgroundImageZoom: parseFloat(e.target.value)
                            }
                            setVariation({ ...variation, slides: updatedSlides })
                          }}
                          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Text Box Controls */}
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
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Text Styling</label>
                        <ToggleGroup
                          type="multiple"
                          value={[
                            selectedTextBox.fontWeight === 'bold' ? 'bold' : '',
                            selectedTextBox.fontStyle === 'italic' ? 'italic' : '',
                            selectedTextBox.textDecoration?.includes('underline') ? 'underline' : ''
                          ].filter(Boolean)}
                          onValueChange={(values) => {
                            const isBold = values.includes('bold')
                            const isItalic = values.includes('italic')
                            const isUnderline = values.includes('underline')
                            
                            updateTextBox(selectedTextBox.id, {
                              fontWeight: isBold ? 'bold' : 'normal',
                              fontStyle: isItalic ? 'italic' : 'normal',
                              textDecoration: isUnderline ? 'underline' : 'none'
                            })
                          }}
                          className="justify-start"
                        >
                          <ToggleGroupItem value="bold" size="sm">
                            <Bold className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="italic" size="sm">
                            <Italic className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="underline" size="sm">
                            <Underline className="h-4 w-4" />
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Text Alignment</label>
                        <ToggleGroup
                          type="single"
                          value={selectedTextBox.textAlign}
                          onValueChange={(value) => updateTextBox(selectedTextBox.id, { textAlign: value || 'center' })}
                          className="justify-start"
                        >
                          <ToggleGroupItem value="left" size="sm">
                            <AlignLeft className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="center" size="sm">
                            <AlignCenter className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="right" size="sm">
                            <AlignRight className="h-4 w-4" />
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Page Alignment</label>
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Horizontal</label>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={selectedTextBox.x <= 0.05 ? "default" : "outline"}
                                onClick={() => alignTextBoxHorizontally('left')}
                                disabled={selectedTextBox.x <= 0.05}
                                className="px-2 py-1 h-7"
                              >
                                <AlignHorizontalJustifyStart className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={Math.abs(selectedTextBox.x + selectedTextBox.width / 2 - 0.5) <= 0.05 ? "default" : "outline"}
                                onClick={() => alignTextBoxHorizontally('center')}
                                disabled={Math.abs(selectedTextBox.x + selectedTextBox.width / 2 - 0.5) <= 0.05}
                                className="px-2 py-1 h-7"
                              >
                                <AlignHorizontalJustifyCenter className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={selectedTextBox.x + selectedTextBox.width >= 0.95 ? "default" : "outline"}
                                onClick={() => alignTextBoxHorizontally('right')}
                                disabled={selectedTextBox.x + selectedTextBox.width >= 0.95}
                                className="px-2 py-1 h-7"
                              >
                                <AlignHorizontalJustifyEnd className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Vertical</label>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={selectedTextBox.y <= 0.05 ? "default" : "outline"}
                                onClick={() => alignTextBoxVertically('top')}
                                disabled={selectedTextBox.y <= 0.05}
                                className="px-2 py-1 h-7"
                              >
                                <AlignVerticalJustifyStart className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={Math.abs(selectedTextBox.y + selectedTextBox.height / 2 - 0.5) <= 0.05 ? "default" : "outline"}
                                onClick={() => alignTextBoxVertically('center')}
                                disabled={Math.abs(selectedTextBox.y + selectedTextBox.height / 2 - 0.5) <= 0.05}
                                className="px-2 py-1 h-7"
                              >
                                <AlignVerticalJustifyCenter className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={selectedTextBox.y + selectedTextBox.height >= 0.95 ? "default" : "outline"}
                                onClick={() => alignTextBoxVertically('bottom')}
                                disabled={selectedTextBox.y + selectedTextBox.height >= 0.95}
                                className="px-2 py-1 h-7"
                              >
                                <AlignVerticalJustifyEnd className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Font Effects Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="h-4 w-4 text-primary" />
                        <label className="text-xs font-medium text-muted-foreground">Font Effects</label>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground">Border Width</label>
                            <span className="text-xs text-muted-foreground">{selectedTextBox.borderWidth || 0}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.5"
                            value={selectedTextBox.borderWidth || 0}
                            onChange={(e) => updateTextBox(selectedTextBox.id, { borderWidth: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
                          />
                        </div>
                        
                        {(selectedTextBox.borderWidth || 0) > 0 && (
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Border Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedTextBox.borderColor || '#000000'}
                                onChange={(e) => updateTextBox(selectedTextBox.id, { borderColor: e.target.value })}
                                className="w-12 h-9 rounded-md border border-input cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={selectedTextBox.borderColor || '#000000'}
                                onChange={(e) => updateTextBox(selectedTextBox.id, { borderColor: e.target.value })}
                                className="flex-1 text-xs font-mono"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Text Shadow</label>
                          <select
                            value={selectedTextBox.textShadow || 'none'}
                            onChange={(e) => {
                              const shadow = e.target.value === 'none' ? undefined : e.target.value
                              updateTextBox(selectedTextBox.id, { textShadow: shadow })
                            }}
                            className="w-full p-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          >
                            <option value="none">None</option>
                            <option value="2px 2px 4px rgba(0,0,0,0.3)">Light Shadow</option>
                            <option value="3px 3px 6px rgba(0,0,0,0.5)">Medium Shadow</option>
                            <option value="4px 4px 8px rgba(0,0,0,0.7)">Strong Shadow</option>
                            <option value="0 0 10px rgba(255,255,255,0.8)">White Glow</option>
                            <option value="0 0 10px rgba(0,0,0,0.8)">Black Glow</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
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

          {/* Canvas Area with DndContext covering entire area */}
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
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                  // Deselect text box if clicking outside the canvas area
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
                      // Deselect elements if clicking on canvas
                      const target = e.target as HTMLElement
                      if (target === e.currentTarget) {
                        setSelectedTextBoxId(null)
                        setSelectedBackgroundImage(false)
                      }
                    }}
                  >
                    {/* Background Image */}
                    {currentSlide?.backgroundImageUrl ? (
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

              {/* Thumbnail Bar - Fixed at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm">
                <div className="p-4">
                  <SortableContext 
                    items={variation.slides.map(slide => slide.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {/* Horizontal Scrollable Thumbnails */}
                    <div className={`thumbnail-scroll-container flex gap-3 overflow-x-auto scrollbar-hide ${isDragging ? 'dragging' : ''}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <style jsx>{`
                        .scrollbar-hide::-webkit-scrollbar {
                          display: none;
                        }
                      `}</style>
                      
                      {variation.slides.map((slide, index) => (
                        <SortableThumbnail
                          key={`${slide.id}-${thumbnailUpdateTrigger}`}
                          slide={slide}
                          index={index}
                          isActive={index === currentSlideIndex}
                          onClick={() => setCurrentSlideIndex(index)}
                          onDelete={() => deleteSlide(index)}
                          canDelete={variation.slides.length > 1}
                        />
                      ))}
                      
                      {/* Add New Slide Button */}
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
              
              {/* DragOverlay at canvas level */}
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
                    {/* Simplified drag overlay preview */}
                    <div className="w-full h-full relative rounded-xl overflow-hidden bg-white/95 backdrop-blur-sm">
                      {(() => {
                        const draggedSlide = variation.slides.find(slide => slide.id === activeId)
                        if (!draggedSlide) return null
                        
                        const slideIndex = variation.slides.findIndex(slide => slide.id === activeId)
                        
                        return (
                          <>
                            {/* Background with reduced opacity for muted effect */}
                            {draggedSlide.backgroundImageUrl ? (
                              <img
                                src={draggedSlide.backgroundImageUrl}
                                alt="Dragging"
                                className="w-full h-full object-cover opacity-80"
                                style={{
                                  objectPosition: `${draggedSlide.backgroundImagePositionX * 100}% ${draggedSlide.backgroundImagePositionY * 100}%`,
                                  transform: `scale(${draggedSlide.backgroundImageZoom})`
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center opacity-80">
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            
                            {/* Slide number badge */}
                            <div className="absolute top-1 right-1">
                              <div className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                {slideIndex + 1}
                              </div>
                            </div>
                            
                            {/* Dragging indicator overlay */}
                            <div className="absolute inset-0 bg-primary/15 rounded-xl border-2 border-primary/40 backdrop-blur-[1px]" />
                            
                            {/* Pulse effect */}
                            <div className="absolute inset-0 rounded-xl border-2 border-primary/60 animate-pulse" />
                          </>
                        )
                      })()}
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