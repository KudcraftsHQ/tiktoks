'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Save,
  Eye,
  Image as ImageIcon,
  Type,
  Settings,
  Palette,
  Download,
  RotateCcw,
  CloudUpload,
  Wand2
} from 'lucide-react'
import { DraggableTextBox } from '@/components/DraggableTextBox'
import { DraggableBackgroundImage } from '@/components/DraggableBackgroundImage'
import { ImageSelectionDialog } from '@/components/ImageSelectionDialog'
import { SortableThumbnail } from '@/components/SortableThumbnail'
import { FloatingSettingsPanel } from '@/components/FloatingSettingsPanel'
import { FloatingBackgroundPanel } from '@/components/FloatingBackgroundPanel'
import { CanvasSidebar, TextElementsSection, BackgroundSection, CanvasSettingsSection } from '@/components/CanvasSidebar'
import { TextStylePanel } from '@/components/TextStylePanel'
import { TextStylesManager } from '@/components/TextStylesManager'
import { RemixUploadsManager } from '@/components/RemixUploadsManager'
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
  RemixSlideType,
  RemixTextBoxType,
  CanvasSizeType
} from '@/lib/validations/remix-schema'
import { CANVAS_SIZES, createDefaultBackgroundLayers, createImageBackgroundLayer, RemixSlideSchema } from '@/lib/validations/remix-schema'
import { useRemixEditorState, type RemixEditorPost } from './useRemixEditorState'
import { useClientSideExport } from '@/hooks/useClientSideExport'
import { HiddenSlideRenderer, type HiddenSlideRendererRef } from '@/components/HiddenSlideRenderer'

// Use the imported types directly
type RemixPost = RemixEditorPost

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
        viewport: slide?.viewport || { zoom: 1, offsetX: 0, offsetY: 0 },
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
        viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
        backgroundLayers: createDefaultBackgroundLayers(),
        originalImageIndex: index,
        paraphrasedText: 'Default slide content',
        textBoxes: []
      })
    }
  })
}

export default function RemixEditor({ params }: EditorProps) {
  const router = useRouter()
  const {
    state: {
      remix,
      currentSlideIndex,
      selectedTextBoxId,
      selectedBackgroundLayerId,
      hasUnsavedChanges
    },
    setRemix: setEditorRemix,
    setCurrentSlideIndex: setEditorCurrentSlideIndex,
    selectTextBox,
    selectBackgroundLayer,
    markDirty,
    updateSlide,
    updateSlideCollection,
    updateSelectedTextBox,
    updateSelectedBackground
  } = useRemixEditorState()
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
  const hiddenSlideRendererRef = useRef<HiddenSlideRendererRef>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isAutoGenerating, setIsAutoGenerating] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedZoom = useRef(false)

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

  useEffect(() => {
    let isCancelled = false

    const loadRemix = async () => {
      console.log('🚀 [RemixEditor] Starting fetchRemix...')
      setIsLoading(true)
      setError(null)

      try {
        console.log('🔍 [RemixEditor] Resolving params...')
        const resolvedParams = await params
        if (isCancelled) return
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
        if (isCancelled) return
        console.log('✅ [RemixEditor] Received data:', {
          id: data.id,
          name: data.name,
          slidesCount: Array.isArray(data.slides) ? data.slides.length : 'not array',
          hasOriginalPost: !!data.originalPost,
          originalPostId: data.originalPost?.id
        })

        const normalizedData = {
          ...data,
          slides: ensureSlidesValid(data.slides || [])
        }

        setEditorRemix(normalizedData)
        console.log('✅ [RemixEditor] Set normalized remix data successfully', {
          originalSlidesCount: Array.isArray(data.slides) ? data.slides.length : 'not array',
          normalizedSlidesCount: normalizedData.slides.length
        })

        if (data.originalPost?.images?.length > 0) {
          console.log('🖼️ [RemixEditor] Using resolved image URLs from API...', data.originalPost.images.length)
          const urls = data.originalPost.images.map((img: any) => img.url)
          if (!isCancelled) {
            setOriginalImageUrls(urls)
            console.log('✅ [RemixEditor] Set original image URLs:', urls.length)
          }
        } else {
          console.log('ℹ️ [RemixEditor] No original images to load')
        }

        console.log('🎉 [RemixEditor] fetchRemix completed successfully')
      } catch (error) {
        if (isCancelled) return
        console.error('💥 [RemixEditor] Error in fetchRemix:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        setError(`Failed to load remix: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
          console.log('🏁 [RemixEditor] fetchRemix finally block - isLoading set to false')
        }
      }
    }

    loadRemix()

    return () => {
      isCancelled = true
    }
  }, [params, setEditorRemix])

  const saveRemix = useCallback(async (isAutoSave = false) => {
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
          slides: remix.slides
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save remix')
      }

      markDirty(false)
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
  }, [remix, params, markDirty])

  // Debounced auto-save function
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveRemix(true)
    }, 2000)
  }, [saveRemix])

  // Mark changes as unsaved and trigger auto-save
  const markAsChanged = useCallback(() => {
    markDirty(true)
    triggerAutoSave()
  }, [markDirty, triggerAutoSave])

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
      viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
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
          width: 1,
          height: 1,
          rotation: 0,
          fitMode: 'cover'
        }
      ],
      originalImageIndex: Math.min(remix.slides.length, (remix.originalPost?.images?.length || 1) - 1),
      paraphrasedText: 'New slide content',
      textBoxes: []
    }

    const newSlides = [...remix.slides, newSlide]
    updateSlideCollection(newSlides)
    setEditorCurrentSlideIndex(newSlides.length - 1)
    markAsChanged()
  }

  const deleteSlide = (slideIndex: number) => {
    if (!remix || remix.slides.length <= 1) return

    const updatedSlides = remix.slides.filter((_, index) => index !== slideIndex)
    updatedSlides.forEach((slide, index) => {
      slide.displayOrder = index
    })

    updateSlideCollection(updatedSlides)

    if (currentSlideIndex >= updatedSlides.length) {
      setEditorCurrentSlideIndex(updatedSlides.length - 1)
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

      if (currentSlideIndex === oldIndex) {
        setEditorCurrentSlideIndex(newIndex)
      } else if (currentSlideIndex > oldIndex && currentSlideIndex <= newIndex) {
        setEditorCurrentSlideIndex(currentSlideIndex - 1)
      } else if (currentSlideIndex < oldIndex && currentSlideIndex >= newIndex) {
        setEditorCurrentSlideIndex(currentSlideIndex + 1)
      }

      updateSlideCollection(updatedSlides)
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
    
    // Calculate z-index: ensure text boxes are always above background layers
    // Background layers use zIndex 1-100, so text boxes start at 100
    const maxTextBoxZIndex = currentSlide.textBoxes.length > 0
      ? Math.max(...currentSlide.textBoxes.map(tb => tb.zIndex))
      : 99
    const newZIndex = Math.max(100, maxTextBoxZIndex + 1)
    
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
      color: '#000000',
      textAlign: 'center',
      zIndex: newZIndex,

      // Text wrapping
      textWrap: 'wrap',

      // Text shadow effects
      enableShadow: false,
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,

      // Text outline effects
      outlineWidth: 0,
      outlineColor: '#000000',

      // Legacy text styling
      textStroke: undefined,
      textShadow: undefined,
      borderWidth: 0,
      borderColor: '#000000',

      // Text background styling
      backgroundColor: '#ffffff',
      backgroundOpacity: 1,
      borderRadius: 0,

      // Padding and spacing
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12,

      // Line height and letter spacing
      lineHeight: 1.2,
      letterSpacing: 0,
      wordSpacing: 0,

      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        skewY: 0
      },
      lockAspectRatio: false
    }

    updateSlide((slide) => ({
      ...slide,
      textBoxes: [...slide.textBoxes, newTextBox]
    }))

    selectTextBox(newTextBox.id)
    // Force thumbnail update on next render
    setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
    markAsChanged()
  }

  const updateTextBox = (textBoxId: string, updates: Partial<RemixTextBoxType>) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    updateSelectedTextBox(textBoxId, (textBox) => {
      const { transform: transformUpdates, ...rest } = updates
      return {
        ...textBox,
        ...rest,
        transform: transformUpdates
          ? { ...textBox.transform, ...transformUpdates }
          : textBox.transform
      }
    })

    // Force thumbnail update on next render
    setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
    markAsChanged()
  }

  const updateBackgroundLayer = (layerId: string, updates: any) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    updateSelectedBackground(layerId, (layer) => ({
      ...layer,
      ...updates
    }))

    // Force thumbnail update on next render
    setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
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

    updateSlide((slide) => ({
      ...slide,
      canvas: { ...slide.canvas, ...updates }
    }))

    // Force thumbnail update on next render
    setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
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

    updateSlide((slide) => ({
      ...slide,
      textBoxes: slide.textBoxes.filter(textBox => textBox.id !== textBoxId)
    }))

    if (selectedTextBoxId === textBoxId) {
      selectTextBox(null)
    }
    // Force thumbnail update on next render
    setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
    markAsChanged()
  }

  const applyBackgroundImageAsset = useCallback((cacheAssetId: string) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    updateSlide((slide) => {
      const existingImageLayerIndex = slide.backgroundLayers.findIndex(layer => layer.type === 'image')

      if (existingImageLayerIndex >= 0) {
        return {
          ...slide,
          backgroundLayers: slide.backgroundLayers.map((layer, index) =>
            index === existingImageLayerIndex
              ? { ...layer, imageId: cacheAssetId }
              : layer
          )
        }
      }

      const imageLayer = createImageBackgroundLayer(cacheAssetId, {
        zIndex: slide.backgroundLayers.length + 1
      })

      return {
        ...slide,
        backgroundLayers: [...slide.backgroundLayers, imageLayer]
      }
    })

    setThumbnailUpdateTrigger(prev => prev + 1)
    markAsChanged()
  }, [remix, currentSlideIndex, updateSlide, markAsChanged])

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
      applyBackgroundImageAsset(cacheAssetId)
      // Force thumbnail update on next render
      setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
      console.log('✅ [RemixEditor] Background image updated successfully')
    } catch (error) {
      console.error('💥 [RemixEditor] Failed to set background image:', error)
      setError('Failed to set background image. Please try again.')
    }
  }

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (!remix || currentSlideIndex >= remix.slides.length) return

    const items = event.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue

        event.preventDefault()

        try {
          const formData = new FormData()
          formData.append('file', file, file.name || `pasted-${Date.now()}.png`)
          formData.append('folder', 'remix/uploads')

          const response = await fetch('/api/cache-assets/upload', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error('Upload failed')
          }

          const data = await response.json()
          if (data?.cacheAssetId) {
            applyBackgroundImageAsset(data.cacheAssetId)
          }
        } catch (uploadError) {
          console.error('Failed to upload pasted image:', uploadError)
          setError('Failed to upload pasted image. Please try again.')
        }

        break
      }
    }
  }, [remix, currentSlideIndex, applyBackgroundImageAsset])

  const handleAutoGenerateSlides = useCallback(async () => {
    if (!remix) return
    if (remix.slides.length > 0) {
      console.warn('Auto-generate skipped because slides already exist')
      return
    }

    try {
      setIsAutoGenerating(true)
      const resolvedParams = await params
      const response = await fetch(`/api/remixes/${resolvedParams.id}/auto-generate`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const data = await response.json()
      const generatedSlides = ensureSlidesValid(data.slides || [])

      if (generatedSlides.length === 0) {
        setError('No slides generated from remix text')
        return
      }

      updateSlideCollection(generatedSlides)
      setEditorCurrentSlideIndex(0)
      markAsChanged()
      setThumbnailUpdateTrigger(prev => prev + 1)
    } catch (generationError) {
      console.error('Failed to auto-generate slides:', generationError)
      setError('Failed to auto-generate slides. Please try again.')
    } finally {
      setIsAutoGenerating(false)
    }
  }, [remix, params, updateSlideCollection, setEditorCurrentSlideIndex, markAsChanged])

  const handleResetSlides = useCallback(async () => {
    if (!remix) return

    try {
      setIsResetting(true)
      
      // Create slides with text boxes containing the paraphrased/original text
      const newSlides: RemixSlideType[] = remix.slides.map((slide, index) => {
        const text = slide.paraphrasedText || slide.originalText || 'Slide content'
        
        // Create a proportional text box (centered, 80% width, auto height)
        // Use z-index 100 to ensure it's above all background layers (which max at 100)
        const textBox: RemixTextBoxType = {
          id: `text_${Date.now()}_${index}`,
          text: text,
          x: 0.1,  // 10% from left
          y: 0.3,  // 30% from top
          width: 0.8,  // 80% of canvas width
          height: 0.4,  // 40% of canvas height
          fontSize: 48,  // Consistent font size for all slides
          fontFamily: 'Poppins',
          fontWeight: 'bold',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#000000',
          textAlign: 'center',
          zIndex: 100,
          textWrap: 'wrap',
          enableShadow: false,
          shadowColor: '#000000',
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          outlineWidth: 0,
          outlineColor: '#000000',
          textStroke: undefined,
          textShadow: undefined,
          borderWidth: 0,
          borderColor: '#000000',
          backgroundColor: '#ffffff',
          backgroundOpacity: 1,
          borderRadius: 0,
          paddingTop: 16,
          paddingRight: 24,
          paddingBottom: 16,
          paddingLeft: 24,
          lineHeight: 1.3,
          letterSpacing: 0,
          wordSpacing: 0,
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            skewX: 0,
            skewY: 0
          },
          lockAspectRatio: false
        }

        return {
          ...slide,
          backgroundLayers: createDefaultBackgroundLayers(),  // Empty white background
          textBoxes: [textBox]
        }
      })

      updateSlideCollection(newSlides)
      setEditorCurrentSlideIndex(0)
      markAsChanged()
      setThumbnailUpdateTrigger(prev => prev + 1)
      setShowResetDialog(false)
    } catch (resetError) {
      console.error('Failed to reset slides:', resetError)
      setError('Failed to reset slides. Please try again.')
    } finally {
      setIsResetting(false)
    }
  }, [remix, updateSlideCollection, setEditorCurrentSlideIndex, markAsChanged])

  // Client-side export hook
  const clientExport = useClientSideExport()

  const exportRemix = async () => {
    if (!remix) {
      console.error('No remix available for export')
      return
    }

    try {
      setError(null)
      setIsExporting(true)

      console.log(`📦 Starting client-side export for remix: ${remix.id}`)

      // Get all slide elements from the hidden renderer
      if (!hiddenSlideRendererRef.current) {
        throw new Error('Hidden slide renderer not available')
      }

      const slideElements = hiddenSlideRendererRef.current.getSlideElements()

      if (slideElements.length === 0) {
        throw new Error('No slide elements found to export')
      }

      console.log(`📦 Exporting ${slideElements.length} slides from hidden renderer...`)

      // Use client-side export
      await clientExport.exportSlidesAsZip(
        slideElements,
        remix.name,
        {
          format: 'png',
          quality: 0.95,
          backgroundColor: null // Let each slide's background show through
        }
      )

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
  const [initialPinchZoom, setInitialPinchZoom] = useState<number>(1)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(canvasZoom * delta, 0.25), 3)
      setCanvasZoom(newZoom)
      // Note: Don't save zoom to slide viewport - we want a global zoom level
      markAsChanged()
    } else {
      e.stopPropagation()
    }
  }, [canvasZoom, markAsChanged])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      setLastPinchDistance(distance)
      setInitialPinchZoom(canvasZoom)
    }
  }, [canvasZoom])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance !== null) {
      e.preventDefault()
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      
      const scale = distance / lastPinchDistance
      const newZoom = Math.min(Math.max(initialPinchZoom * scale, 0.25), 3)
      setCanvasZoom(newZoom)
    }
  }, [lastPinchDistance, initialPinchZoom])

  const handleTouchEnd = useCallback(() => {
    setLastPinchDistance(null)
  }, [])

  const calculateAutoFitZoom = useCallback((slide?: any) => {
    if (!canvasContainerRef.current) return 1

    const container = canvasContainerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Use actual canvas dimensions from provided slide or default
    const canvasWidth = slide?.canvas?.width || CANVAS_SIZES.INSTAGRAM_STORY.width
    const canvasHeight = slide?.canvas?.height || CANVAS_SIZES.INSTAGRAM_STORY.height
    const padding = 80

    const availableWidth = containerWidth - (padding * 2)
    const availableHeight = containerHeight - (padding * 2)

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

  // Auto-fit zoom only on initial mount
  useEffect(() => {
    if (!remix || !canvasContainerRef.current || hasInitializedZoom.current) return

    const initializeZoom = () => {
      const slide = remix?.slides?.[currentSlideIndex]
      const newAutoFitZoom = calculateAutoFitZoom(slide)
      setAutoFitZoom(newAutoFitZoom)
      setCanvasZoom(newAutoFitZoom)
      setCanvasPosition({ x: 0, y: 0 })
      hasInitializedZoom.current = true
    }

    setTimeout(initializeZoom, 100)
  }, [remix, calculateAutoFitZoom, currentSlideIndex])

  // Update autoFitZoom on window resize (for the Fit button), but don't change actual zoom
  useEffect(() => {
    const updateAutoFit = () => {
      const slide = remix?.slides?.[currentSlideIndex]
      const newAutoFitZoom = calculateAutoFitZoom(slide)
      setAutoFitZoom(newAutoFitZoom)
    }

    window.addEventListener('resize', updateAutoFit)
    return () => window.removeEventListener('resize', updateAutoFit)
  }, [calculateAutoFitZoom, remix?.slides, currentSlideIndex])

  // When switching slides, maintain the current zoom level and reset position
  useEffect(() => {
    if (!remix || !hasInitializedZoom.current) return
    
    // Reset canvas position when switching slides, but keep zoom level
    setCanvasPosition({ x: 0, y: 0 })
  }, [currentSlideIndex, remix])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      handlePaste(event)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handlePaste])

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
          <Button onClick={() => router.push(`/posts/${remix?.originalPost?.id}/remix`)} variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
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
              variant="secondary"
              size="icon"
              className="rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                {remix.name}
              </h1>
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
              <Button
                onClick={handleAutoGenerateSlides}
                disabled={!remix || (remix.slides?.length ?? 0) > 0 || isAutoGenerating}
                variant="outline"
                size="sm"
              >
                {isAutoGenerating ? 'Generating…' : 'Auto generate'}
              </Button>
              <Button
                onClick={() => setShowResetDialog(true)}
                disabled={!remix || isResetting}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {isResetting ? 'Resetting...' : 'Reset Slides'}
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
        {/* New Canva-style Sidebar with vertical tabs */}
        <CanvasSidebar
          tabs={[
            // Text Tab
            {
              id: 'text',
              label: 'Text',
              icon: Type,
              content: (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Text</h2>
                  
                  {/* Text Styles Manager */}
                  {remix && (
                    <TextStylesManager
                      remixId={remix.id}
                      selectedTextBox={selectedTextBox || undefined}
                      onApplyStyle={(style) => {
                        if (selectedTextBox) {
                          // Apply to selected text box
                          updateTextBox(selectedTextBox.id, {
                            fontSize: style.fontSize,
                            fontFamily: style.fontFamily,
                            fontWeight: style.fontWeight as any,
                            fontStyle: style.fontStyle as any,
                            textDecoration: style.textDecoration as any,
                            color: style.color,
                            textAlign: style.textAlign as any,
                            enableShadow: style.enableShadow,
                            shadowColor: style.shadowColor,
                            shadowBlur: style.shadowBlur,
                            shadowOffsetX: style.shadowOffsetX,
                            shadowOffsetY: style.shadowOffsetY,
                            outlineWidth: style.outlineWidth,
                            outlineColor: style.outlineColor,
                            backgroundColor: style.backgroundColor,
                            backgroundOpacity: style.backgroundOpacity,
                            borderRadius: style.borderRadius,
                            borderWidth: style.borderWidth,
                            borderColor: style.borderColor,
                            paddingTop: style.paddingTop,
                            paddingRight: style.paddingRight,
                            paddingBottom: style.paddingBottom,
                            paddingLeft: style.paddingLeft,
                            lineHeight: style.lineHeight,
                            letterSpacing: style.letterSpacing,
                            wordSpacing: style.wordSpacing
                          })
                        } else if (currentSlide?.textBoxes) {
                          // Apply to all text boxes in current slide
                          updateSlide((slide) => ({
                            ...slide,
                            textBoxes: slide.textBoxes.map((tb) => ({
                              ...tb,
                              fontSize: style.fontSize,
                              fontFamily: style.fontFamily,
                              fontWeight: style.fontWeight as any,
                              fontStyle: style.fontStyle as any,
                              textDecoration: style.textDecoration as any,
                              color: style.color,
                              textAlign: style.textAlign as any,
                              enableShadow: style.enableShadow,
                              shadowColor: style.shadowColor,
                              shadowBlur: style.shadowBlur,
                              shadowOffsetX: style.shadowOffsetX,
                              shadowOffsetY: style.shadowOffsetY,
                              outlineWidth: style.outlineWidth,
                              outlineColor: style.outlineColor,
                              backgroundColor: style.backgroundColor,
                              backgroundOpacity: style.backgroundOpacity,
                              borderRadius: style.borderRadius,
                              borderWidth: style.borderWidth,
                              borderColor: style.borderColor,
                              paddingTop: style.paddingTop,
                              paddingRight: style.paddingRight,
                              paddingBottom: style.paddingBottom,
                              paddingLeft: style.paddingLeft,
                              lineHeight: style.lineHeight,
                              letterSpacing: style.letterSpacing,
                              wordSpacing: style.wordSpacing
                            }))
                          }))
                          setThumbnailUpdateTrigger(prev => prev + 1)
                        }
                        markAsChanged()
                      }}
                      onSaveCurrentAsStyle={(name) => {
                        // This is handled internally by TextStylesManager
                      }}
                    />
                  )}
                  
                  {selectedTextBox ? (
                    <>
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-medium mb-3">Edit Text Box</h3>
                        <TextStylePanel
                          selectedTextBox={selectedTextBox}
                          onUpdate={(updates) => updateTextBox(selectedTextBox.id, updates)}
                          onDelete={() => deleteTextBox(selectedTextBox.id)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border-t pt-4">
                        <Button
                          onClick={addTextBox}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-8"
                        >
                          <Plus className="h-3.5 w-3.5 mr-2" />
                          Add Text
                        </Button>
                      </div>
                      
                      {currentSlide?.textBoxes && currentSlide.textBoxes.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-muted-foreground px-0.5 py-1">
                            {currentSlide.textBoxes.length} text {currentSlide.textBoxes.length === 1 ? 'element' : 'elements'}
                          </div>
                          {currentSlide.textBoxes.map((textBox, index) => (
                            <div
                              key={textBox.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => selectTextBox(textBox.id)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Type className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  {textBox.text || `Text ${index + 1}`}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteTextBox(textBox.id)
                                }}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            },
            
            // Uploads Tab
            {
              id: 'uploads',
              label: 'Uploads',
              icon: CloudUpload,
              content: remix ? (
                <RemixUploadsManager
                  remixId={remix.id}
                  onSelectImage={async (url, cacheAssetId) => {
                    // Apply as background
                    applyBackgroundImageAsset(cacheAssetId)
                    setTimeout(() => setThumbnailUpdateTrigger(prev => prev + 1), 0)
                  }}
                />
              ) : null
            },
            
            // Original Images Tab
            {
              id: 'original',
              label: 'Original',
              icon: Eye,
              content: (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Original Images</h2>
                  
                  {originalImageUrls.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No original images</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {originalImageUrls.map((url, index) => (
                        <div key={index} className="flex-shrink-0">
                          <div className="aspect-[9/16] bg-muted rounded overflow-hidden border cursor-pointer hover:border-primary transition-colors"
                            onClick={() => handleImageSelect(url)}
                          >
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
                            Image {index + 1}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            },
            
            // Imagine Tab (placeholder)
            {
              id: 'imagine',
              label: 'Imagine',
              icon: Wand2,
              content: (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Imagine</h2>
                  <div className="text-center py-12 text-muted-foreground">
                    <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">AI image generation</p>
                    <p className="text-xs mt-1">Coming soon</p>
                  </div>
                </div>
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
              data-export-canvas="true"
              className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden canvas-editor-area"
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  selectTextBox(null)
                  selectBackgroundLayer(null)
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
                  data-slide-canvas="true"
                  className={`bg-white rounded-lg shadow-lg relative ${selectedBackgroundLayerId ? 'overflow-visible' : 'overflow-hidden'}`}
                  style={{
                    width: canvasWidth,
                    height: canvasHeight
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target === e.currentTarget) {
                      selectTextBox(null)
                      selectBackgroundLayer(null)
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
                            selectBackgroundLayer(layer.id)
                            selectTextBox(null)
                          }}
                          onDeselect={() => {
                            selectBackgroundLayer(null)
                            selectTextBox(null)
                          }}
                          anyOtherSelected={!!selectedTextBoxId}
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
                          selectBackgroundLayer(layer.id)
                          selectTextBox(null)
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
                        selectTextBox(textBox.id)
                        selectBackgroundLayer(null)
                        updateFloatingPanelPosition(textBox.id)
                      }}
                      onDeselect={() => {
                        selectTextBox(null)
                        selectBackgroundLayer(null)
                      }}
                      anyOtherSelected={!!selectedBackgroundLayerId}
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

              {/* Floating Background Panel */}
              {selectedBackgroundLayerId && currentSlide && (
                <FloatingBackgroundPanel
                  layer={currentSlide.backgroundLayers.find(bl => bl.id === selectedBackgroundLayerId) || null}
                  onUpdate={(updates) => updateBackgroundLayer(selectedBackgroundLayerId, updates)}
                />
              )}
            </div>

            {/* Thumbnail Bar */}
            <div className="border-t bg-background">
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
                          onClick={() => setEditorCurrentSlideIndex(index)}
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

      {/* Reset Slides Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset All Slides?</DialogTitle>
            <DialogDescription>
              This will replace all slides with text boxes containing the remix text on empty white backgrounds.
              All current backgrounds, text boxes, and styling will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetSlides}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset Slides'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden slide renderer for export - renders all slides off-screen */}
      {remix && (
        <HiddenSlideRenderer
          ref={hiddenSlideRendererRef}
          slides={remix.slides}
          backgroundImageUrls={backgroundImageUrls}
        />
      )}
    </div>
  )
}