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
import { FloatingSettingsPanel } from '@/components/FloatingSettingsPanel'
import { CanvasSidebar, TextElementsSection, BackgroundSection, CanvasSettingsSection } from '@/components/CanvasSidebar'
import { TextStylePanel } from '@/components/TextStylePanel'
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

// Import the new types from validation schema
import type {
  RemixPostType,
  RemixSlideType,
  RemixTextBoxType,
  CanvasSizeType,
  BackgroundLayerType
} from '@/lib/validations/remix-schema'
import { CANVAS_SIZES, createDefaultBackgroundLayers, createImageBackgroundLayer, RemixSlideSchema } from '@/lib/validations/remix-schema'

// Use the imported types directly
interface RemixPost extends RemixPostType {
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
  params: Promise<{ id: string }>
}

// Frontend utility to ensure slides are properly bootstrapped
function ensureSlidesValid(slides: any[]): RemixSlideType[] {
  if (!Array.isArray(slides) || slides.length === 0) {
    return []
  }

  return slides.map((slide: any, index: number) => {
    try {
      // Create a base slide with fallback values
      const baseSlide = {
        id: slide?.id || `slide_${Date.now()}_${index}`,
        displayOrder: slide?.displayOrder ?? index,
        canvas: slide?.canvas || CANVAS_SIZES.INSTAGRAM_STORY,
        backgroundLayers: slide?.backgroundLayers || createDefaultBackgroundLayers(),
        originalImageIndex: slide?.originalImageIndex ?? index,
        paraphrasedText: slide?.paraphrasedText || '',
        originalText: slide?.originalText || '',
        textBoxes: slide?.textBoxes || [],
        ...slide
      }

      // Validate using schema (applies schema defaults)
      return RemixSlideSchema.parse(baseSlide)
    } catch (error) {
      console.warn(`Failed to normalize slide ${index}, using default:`, error)
      // Return a safe fallback slide
      return RemixSlideSchema.parse({
        id: `slide_${Date.now()}_${index}`,
        displayOrder: index,
        canvas: CANVAS_SIZES.INSTAGRAM_STORY,
        backgroundLayers: createDefaultBackgroundLayers(),
        originalImageIndex: index,
        paraphrasedText: 'Default slide content',
        textBoxes: []
      })
    }
  })
}

export default function RemixEditor({ params }: EditorProps) {
  console.log('🎬 [RemixEditor] Component initializing...')

  const router = useRouter()
  const [remix, setRemix] = useState<RemixPost | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [selectedBackgroundLayerId, setSelectedBackgroundLayerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [thumbnailUpdateTrigger, setThumbnailUpdateTrigger] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [autoFitZoom, setAutoFitZoom] = useState(1)
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 })
  const [backgroundImageUrls, setBackgroundImageUrls] = useState<Record<string, string>>({})
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Original images for reference
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([])

  // Floating panel state
  const [floatingPanelPosition, setFloatingPanelPosition] = useState({ x: 0, y: 0 })
  const [showFloatingPanel, setShowFloatingPanel] = useState(true)

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

  const fetchRemix = useCallback(async () => {
    console.log('🚀 [RemixEditor] Starting fetchRemix...')
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 [RemixEditor] Resolving params...')
      const resolvedParams = await params
      console.log('✅ [RemixEditor] Resolved params:', resolvedParams)

      const apiUrl = `/api/remixes/${resolvedParams.id}`
      console.log('🌐 [RemixEditor] Fetching from:', apiUrl)

      const response = await fetch(apiUrl)
      console.log('📡 [RemixEditor] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ [RemixEditor] Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`Failed to fetch remix: ${response.status} ${response.statusText}`)
      }

      console.log('📝 [RemixEditor] Parsing JSON response...')
      const data = await response.json()
      console.log('✅ [RemixEditor] Received data:', {
        id: data.id,
        name: data.name,
        slidesCount: Array.isArray(data.slides) ? data.slides.length : 'not array',
        hasOriginalPost: !!data.originalPost,
        originalPostId: data.originalPost?.id
      })

      // Normalize slides before setting the state
      const normalizedData = {
        ...data,
        slides: ensureSlidesValid(data.slides || [])
      }

      setRemix(normalizedData)
      console.log('✅ [RemixEditor] Set normalized remix data successfully', {
        originalSlidesCount: Array.isArray(data.slides) ? data.slides.length : 'not array',
        normalizedSlidesCount: normalizedData.slides.length
      })

      // Load original images for reference - URLs are already resolved by the API
      if (data.originalPost?.images?.length > 0) {
        console.log('🖼️ [RemixEditor] Using resolved image URLs from API...', data.originalPost.images.length)
        const urls = data.originalPost.images.map((img: any) => img.url)
        setOriginalImageUrls(urls)
        console.log('✅ [RemixEditor] Set original image URLs:', urls.length)
      } else {
        console.log('ℹ️ [RemixEditor] No original images to load')
      }

      console.log('🎉 [RemixEditor] fetchRemix completed successfully')
    } catch (error) {
      console.error('💥 [RemixEditor] Error in fetchRemix:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      setError(`Failed to load remix: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      console.log('🏁 [RemixEditor] fetchRemix finally block - isLoading set to false')
    }
  }, [params])

  const saveRemix = async (isAutoSave = false) => {
    if (!remix) return

    if (isAutoSave) {
      setIsAutoSaving(true)
    } else {
      setIsSaving(true)
    }

    try {
      const resolvedParams = await params
      const response = await fetch(`/api/remixes/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: remix.name,
          description: remix.description,
          slides: remix.slides // Send the entire slides array with new structure
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

    const newSlide: RemixSlideType = {
      id: `temp-${Date.now()}`,
      displayOrder: remix.slides.length,
      canvas: {
        width: 1080,
        height: 1920,
        unit: 'px'
      },
      backgroundLayers: [
        {
          id: `bg_${Date.now()}_1`,
          type: 'color',
          color: '#ffffff',
          opacity: 1,
          blendMode: 'normal',
          zIndex: 1,
          x: 0,
          y: 0,
          width: 1080,
          height: 1920
        }
      ],
      originalImageIndex: Math.min(remix.slides.length, (remix.originalPost.images.length || 1) - 1),
      paraphrasedText: 'New slide content',
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
    const newTextBox: RemixTextBoxType = {
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

      // Text wrapping
      textWrap: 'none',

      // Text shadow effects
      enableShadow: false,
      shadowColor: '#000000',
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,

      // Text outline effects
      outlineWidth: 0,
      outlineColor: '#000000',

      // Legacy text styling
      textStroke: undefined,
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
      borderWidth: 0,
      borderColor: '#000000',

      // Text background styling
      backgroundColor: undefined,
      backgroundOpacity: 1,
      borderRadius: 0,

      // Padding and spacing
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12,

      // Line height and letter spacing
      lineHeight: 1.2,
      letterSpacing: 0
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

  const updateTextBox = (textBoxId: string, updates: Partial<RemixTextBoxType>) => {
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

  const updateBackgroundLayer = (layerId: string, updates: any) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const updatedSlides = [...remix.slides]
    const currentSlide = updatedSlides[currentSlideIndex]

    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      backgroundLayers: currentSlide.backgroundLayers?.map((layer: any) =>
        layer.id === layerId ? { ...layer, ...updates } : layer
      ) || []
    }

    setRemix({
      ...remix,
      slides: updatedSlides
    })

    setThumbnailUpdateTrigger(prev => prev + 1)
    markAsChanged()
  }

  // Update floating panel position when text box is selected
  const updateFloatingPanelPosition = useCallback((textBoxId: string) => {
    const slide = remix?.slides?.[currentSlideIndex]
    if (!slide || !canvasContainerRef.current) return

    const textBox = slide.textBoxes.find(tb => tb.id === textBoxId)
    if (!textBox) return

    const canvasContainer = canvasContainerRef.current
    const canvasRect = canvasContainer.getBoundingClientRect()

    // Calculate text box position on screen
    const canvasWidth = slide?.canvas?.width || CANVAS_SIZES.INSTAGRAM_STORY.width
    const canvasHeight = slide?.canvas?.height || CANVAS_SIZES.INSTAGRAM_STORY.height

    const textBoxX = canvasRect.left + (textBox.x * canvasWidth * canvasZoom)
    const textBoxY = canvasRect.top + (textBox.y * canvasHeight * canvasZoom)

    setFloatingPanelPosition({
      x: textBoxX,
      y: textBoxY
    })
  }, [remix?.slides, currentSlideIndex, canvasZoom])

  const updateCanvas = (updates: Partial<CanvasSizeType>) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const updatedSlides = [...remix.slides]
    const currentSlide = updatedSlides[currentSlideIndex]

    updatedSlides[currentSlideIndex] = {
      ...currentSlide,
      canvas: { ...currentSlide.canvas, ...updates }
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

  const handleImageSelect = async (imageUrl: string) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    try {
      console.log('🖼️ [RemixEditor] Processing background image selection:', imageUrl)

      let cacheAssetId = imageUrl

      // If the imageUrl is a full URL (not already a cache asset ID), create a cache asset
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        console.log('🔄 [RemixEditor] Creating cache asset for URL:', imageUrl)
        // In production, this would call the cache asset API endpoint
        // For now, we'll simulate this by making an API call
        const response = await fetch('/api/cache-assets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalUrl: imageUrl,
            folder: 'remix-backgrounds'
          }),
        })

        if (response.ok) {
          const { cacheAssetId: newCacheAssetId } = await response.json()
          cacheAssetId = newCacheAssetId
          console.log('✅ [RemixEditor] Created cache asset:', cacheAssetId)
        } else {
          console.warn('⚠️ [RemixEditor] Failed to create cache asset, using original URL')
          cacheAssetId = imageUrl
        }
      }

      const updatedSlides = [...remix.slides]
      const currentSlide = updatedSlides[currentSlideIndex]

      // Create a new image background layer or update existing one
      const existingImageLayerIndex = currentSlide.backgroundLayers.findIndex(layer => layer.type === 'image')

      if (existingImageLayerIndex >= 0) {
        // Update existing image layer
        updatedSlides[currentSlideIndex] = {
          ...currentSlide,
          backgroundLayers: currentSlide.backgroundLayers.map((layer, index) =>
            index === existingImageLayerIndex
              ? { ...layer, imageId: cacheAssetId }
              : layer
          )
        }
      } else {
        // Add new image background layer
        const imageLayer = createImageBackgroundLayer(cacheAssetId, {
          zIndex: currentSlide.backgroundLayers.length + 1
        })

        updatedSlides[currentSlideIndex] = {
          ...currentSlide,
          backgroundLayers: [...currentSlide.backgroundLayers, imageLayer]
        }
      }

      setRemix({
        ...remix,
        slides: updatedSlides
      })
      markAsChanged()
      console.log('✅ [RemixEditor] Background image updated successfully')
    } catch (error) {
      console.error('💥 [RemixEditor] Failed to set background image:', error)
      setError('Failed to set background image. Please try again.')
    }
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
      // Prevent default behavior and stop event bubbling
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(canvasZoom * delta, 0.25), 3)
      setCanvasZoom(newZoom)
    } else {
      // For non-zoom wheel events, also prevent bubbling to parent
      e.stopPropagation()
    }
  }, [canvasZoom])

  const calculateAutoFitZoom = useCallback((slide?: any) => {
    if (!canvasContainerRef.current) return 1

    const container = canvasContainerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Use actual canvas dimensions from provided slide or default
    const canvasWidth = slide?.canvas?.width || CANVAS_SIZES.INSTAGRAM_STORY.width
    const canvasHeight = slide?.canvas?.height || CANVAS_SIZES.INSTAGRAM_STORY.height
    const padding = 40

    const availableWidth = containerWidth - (padding * 2)
    const availableHeight = containerHeight - (padding * 2) - 160

    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight

    const scale = Math.min(scaleX, scaleY, 1)

    return Math.max(scale, 0.1)
  }, [])

  const resetZoom = useCallback(() => {
    const slide = remix?.slides?.[currentSlideIndex]
    const newAutoFitZoom = calculateAutoFitZoom(slide)
    setAutoFitZoom(newAutoFitZoom)
    setCanvasZoom(newAutoFitZoom)
    setCanvasPosition({ x: 0, y: 0 })
  }, [calculateAutoFitZoom, remix?.slides, currentSlideIndex])

  // Auto-fit zoom on mount and resize
  useEffect(() => {
    const updateAutoFit = () => {
      const slide = remix?.slides?.[currentSlideIndex]
      const newAutoFitZoom = calculateAutoFitZoom(slide)
      setAutoFitZoom(newAutoFitZoom)
      setCanvasZoom(newAutoFitZoom)
    }

    setTimeout(updateAutoFit, 100)
    window.addEventListener('resize', updateAutoFit)
    return () => window.removeEventListener('resize', updateAutoFit)
  }, [calculateAutoFitZoom, remix?.slides, currentSlideIndex])

  useEffect(() => {
    console.log('🔄 [RemixEditor] useEffect triggered - calling fetchRemix')
    fetchRemix()
  }, [fetchRemix])

  useEffect(() => {
    const slide = remix?.slides?.[currentSlideIndex]
    if (remix && canvasContainerRef.current && slide) {
      setTimeout(() => {
        const newAutoFitZoom = calculateAutoFitZoom(slide)
        setAutoFitZoom(newAutoFitZoom)
        setCanvasZoom(newAutoFitZoom)
      }, 200)
    }
  }, [remix, calculateAutoFitZoom, currentSlideIndex])

  // Resolve background image URLs using CacheAssetService
  useEffect(() => {
    const resolveBackgroundImageUrls = async () => {
      if (!remix?.slides) return

      const imageIds: string[] = []
      const imageIdToLayerMap: Record<string, string> = {}

      // Collect all background image IDs from all slides
      remix.slides.forEach((slide: any) => {
        slide.backgroundLayers?.forEach((layer: any) => {
          if (layer.type === 'image' && layer.imageId) {
            imageIds.push(layer.imageId)
            imageIdToLayerMap[layer.imageId] = layer.id
          }
        })
      })

      if (imageIds.length === 0) return

      try {
        // Use the cache asset client to resolve URLs
        const urlPromises = imageIds.map(async (imageId) => {
          const response = await fetch(`/api/cache-assets?id=${imageId}`)
          if (response.ok) {
            const data = await response.json()
            return { imageId, url: data.url }
          }
          return { imageId, url: `/api/assets/${imageId}` } // fallback
        })

        const resolvedUrls = await Promise.all(urlPromises)
        const urlMap: Record<string, string> = {}
        resolvedUrls.forEach(({ imageId, url }) => {
          urlMap[imageId] = url
        })

        setBackgroundImageUrls(urlMap)
      } catch (error) {
        console.error('Failed to resolve background image URLs:', error)
      }
    }

    resolveBackgroundImageUrls()
  }, [remix?.slides])

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
    console.log('⏳ [RemixEditor] Rendering loading state')
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
    console.log('❌ [RemixEditor] Rendering error state:', { error, hasRemix: !!remix })
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

  // Get current slide with defensive defaults
  const currentSlide = remix?.slides?.[currentSlideIndex] || null

  // Defensive canvas dimensions with fallbacks
  const canvasWidth = currentSlide?.canvas?.width || CANVAS_SIZES.INSTAGRAM_STORY.width
  const canvasHeight = currentSlide?.canvas?.height || CANVAS_SIZES.INSTAGRAM_STORY.height

  const selectedTextBox = selectedTextBoxId && currentSlide?.textBoxes
    ? currentSlide.textBoxes.find(tb => tb.id === selectedTextBoxId)
    : null
  const selectedBackgroundLayer = selectedBackgroundLayerId && currentSlide?.backgroundLayers
    ? currentSlide.backgroundLayers.find(bl => bl.id === selectedBackgroundLayerId)
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

      {/* Main Editor - Redesigned with new sidebar */}
      <div className="flex h-[calc(100vh-80px)] overflow-hidden">
        {/* New Canva-style Sidebar */}
        <CanvasSidebar
          sections={[
            // Original Reference Images (always shown)
            ...(originalImageUrls.length > 0 ? [{
              id: 'reference',
              title: 'Original Reference',
              icon: Eye,
              isExpanded: true,
              content: (
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
              )
            }] : []),

            // Canvas Settings (when no text box selected)
            ...(!selectedTextBox ? [{
              id: 'canvas',
              title: 'Canvas Settings',
              icon: Settings,
              isExpanded: true,
              content: (
                <CanvasSettingsSection
                  canvas={currentSlide?.canvas || CANVAS_SIZES.INSTAGRAM_STORY}
                  onUpdateCanvas={updateCanvas}
                  presets={[
                    { name: 'Instagram Story', width: 1080, height: 1920 },
                    { name: 'Instagram Post', width: 1080, height: 1080 },
                    { name: 'TikTok', width: 1080, height: 1920 },
                    { name: 'Facebook Post', width: 1200, height: 630 },
                    { name: 'Custom', width: 1080, height: 1920 }
                  ]}
                />
              )
            }] : []),

            // Background Settings
            {
              id: 'background',
              title: 'Background',
              icon: Palette,
              isExpanded: true,
              content: (
                <BackgroundSection
                  onChangeBackground={() => setShowImageDialog(true)}
                  hasBackgroundImage={currentSlide?.backgroundLayers.some(layer => layer.type === 'image')}
                />
              )
            },

            // Text Elements Section
            {
              id: 'text',
              title: 'Text Elements',
              icon: Type,
              isExpanded: true,
              content: selectedTextBox ? (
                <TextStylePanel
                  selectedTextBox={selectedTextBox}
                  onUpdate={(updates) => updateTextBox(selectedTextBox.id, updates)}
                  onDelete={() => deleteTextBox(selectedTextBox.id)}
                />
              ) : (
                <TextElementsSection
                  selectedTextBox={selectedTextBox}
                  onAddTextBox={addTextBox}
                  onDeleteTextBox={deleteTextBox}
                  textBoxes={currentSlide?.textBoxes || []}
                />
              )
            }
          ]}
        />

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
              className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden canvas-editor-area"
              style={{ paddingBottom: '160px' }}
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
                  style={{
                    width: canvasWidth,
                    height: canvasHeight
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target === e.currentTarget) {
                      setSelectedTextBoxId(null)
                      setSelectedBackgroundLayerId(null)
                    }
                  }}
                >
                  {/* Background Layers */}
                  {currentSlide?.backgroundLayers && currentSlide.backgroundLayers.map((layer) => {
                    if (layer.type === 'image' && layer.imageId) {
                      // Use DraggableBackgroundImage for image layers
                      return (
                        <DraggableBackgroundImage
                          key={layer.id}
                          layer={layer as any}
                          imageUrl={backgroundImageUrls[layer.imageId] || `/api/assets/${layer.imageId}`}
                          isSelected={selectedBackgroundLayerId === layer.id}
                          onSelect={() => {
                            setSelectedBackgroundLayerId(layer.id)
                            setSelectedTextBoxId(null)
                          }}
                          onUpdate={(updates) => updateBackgroundLayer(layer.id, updates)}
                          containerWidth={currentSlide?.canvas.width || 540}
                          containerHeight={currentSlide?.canvas.height || 960}
                        />
                      )
                    } else {
                      // Render other layer types (color, gradient)
                      return (
                        <div
                          key={layer.id}
                          className="absolute inset-0"
                          style={{
                            backgroundColor: layer.type === 'color' ? layer.color : undefined,
                            backgroundImage: layer.type === 'gradient' ?
                              `linear-gradient(${layer.gradient?.angle || 0}deg, ${layer.gradient?.colors.join(', ')})` :
                              undefined,
                            opacity: layer.opacity,
                            mixBlendMode: layer.blendMode as any,
                            zIndex: Math.max((layer.zIndex || 1), 1)
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBackgroundLayerId(layer.id)
                            setSelectedTextBoxId(null)
                          }}
                        />
                      )
                    }
                  })}

                  {/* Default background if no layers */}
                  {!currentSlide?.backgroundLayers?.length && (
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
                  {currentSlide?.textBoxes && currentSlide.textBoxes.map((textBox) => (
                    <DraggableTextBox
                      key={textBox.id}
                      textBox={textBox}
                      isSelected={selectedTextBoxId === textBox.id}
                      onSelect={() => {
                        setSelectedTextBoxId(textBox.id)
                        setSelectedBackgroundLayerId(null)
                        updateFloatingPanelPosition(textBox.id)
                      }}
                      onUpdate={(updates) => updateTextBox(textBox.id, updates)}
                      containerWidth={currentSlide?.canvas.width || 540}
                      containerHeight={currentSlide?.canvas.height || 960}
                    />
                  ))}
                </div>
              </div>

              {/* Floating Settings Panel - positioned within canvas container but not affected by zoom */}
              {selectedTextBoxId && currentSlide && (
                <FloatingSettingsPanel
                  selectedTextBox={currentSlide.textBoxes.find(tb => tb.id === selectedTextBoxId) || null}
                  onUpdateTextBox={(updates) => updateTextBox(selectedTextBoxId, updates)}
                  position={{ x: 0, y: 0 }}
                  canvasZoom={1}
                />
              )}
            </div>

            {/* Thumbnail Bar */}
            <div className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm">
              <div className="p-4">
                <SortableContext
                  items={remix.slides.map(slide => slide.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className={`thumbnail-scroll-container flex gap-3 overflow-x-auto scrollbar-hide ${isDragging ? 'dragging' : ''}`}>
                    {remix.slides.map((slide, index) => {
                      // Find background image from backgroundLayers and resolve URL
                      const backgroundImageLayer = slide.backgroundLayers?.find((layer: any) => layer.type === 'image')
                      const backgroundImageUrl = backgroundImageLayer?.imageId
                        ? backgroundImageUrls[backgroundImageLayer.imageId] || `/api/assets/${backgroundImageLayer.imageId}`
                        : null

                      const slideWithResolvedUrl = {
                        ...slide,
                        backgroundImageUrl
                      }

                      return (
                        <SortableThumbnail
                          key={`${slide.id}-${thumbnailUpdateTrigger}`}
                          slide={slideWithResolvedUrl as any}
                          index={index}
                          isActive={index === currentSlideIndex}
                          onClick={() => setCurrentSlideIndex(index)}
                          onDelete={() => deleteSlide(index)}
                          canDelete={remix.slides.length > 1}
                        />
                      )
                    })}

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