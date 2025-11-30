'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { ImageIcon } from 'lucide-react'
import type { RemixSlideType, RemixTextBoxType } from '@/lib/validations/remix-schema'
import { getSlideCacheKey, THUMBNAIL_SIZES, type ThumbnailDimensions } from '@/lib/slide-renderer'
import { getProxiedImageUrlById } from '@/lib/image-proxy'
import { TextOverlayRender } from '@/components/mobile/TextOverlayBox'
import type { TextOverlay, TextOverlayAlignment, TextOverlayStyle } from '@/lib/text-overlay-utils'
import { generateOverlayId, parseTextToOverlays } from '@/lib/text-overlay-utils'

interface SlideThumbnailProps {
  slide: RemixSlideType
  slideIndex: number
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
  /** Force re-render counter - increment to trigger re-render */
  renderKey?: number
}

// Helper to check if slide has a background image
const hasBackgroundImage = (slide: RemixSlideType): boolean => {
  return slide.backgroundLayers?.some(layer => layer.type === 'image' && layer.cacheAssetId) || false
}

// Helper to get background image cache asset ID
const getBackgroundImageId = (slide: RemixSlideType): string | null => {
  const imageLayer = slide.backgroundLayers?.find(layer => layer.type === 'image' && layer.cacheAssetId)
  return imageLayer?.cacheAssetId || null
}

/**
 * Convert saved textBoxes to mobile TextOverlay format for rendering
 */
function textBoxesToOverlays(textBoxes: RemixTextBoxType[]): TextOverlay[] {
  if (!Array.isArray(textBoxes) || textBoxes.length === 0) {
    return []
  }

  return textBoxes.map((box) => ({
    id: box.id || generateOverlayId(),
    text: box.text || '',
    x: box.x ?? 0.5,
    y: box.y ?? 0.5,
    fontSize: box.fontSize ?? 48,
    alignment: (box.textAlign || 'center') as TextOverlayAlignment,
    // Recover mobile style from saved data
    style: ((box as any)._mobileStyle || (box.backgroundOpacity && box.backgroundOpacity > 0 ? 'pill' : 'outline')) as TextOverlayStyle,
    maxWidth: (box as any)._mobileMaxWidth ?? box.width ?? 0.6,
  }))
}

// Global thumbnail cache to avoid re-rendering
const thumbnailCache = new Map<string, string>()

export function SlideThumbnail({
  slide,
  slideIndex,
  loading = false,
  size = 'sm',
  onClick,
  className = '',
  renderKey = 0
}: SlideThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLButtonElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const dimensions: ThumbnailDimensions = THUMBNAIL_SIZES[size]
  const cacheKey = useMemo(() => getSlideCacheKey(slide) + size + renderKey, [slide, size, renderKey])

  // Update container size for text overlay scaling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    // Small delay to ensure container is fully rendered
    const timeout = setTimeout(updateSize, 50)

    window.addEventListener('resize', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
      clearTimeout(timeout)
    }
  }, [dimensions])

  useEffect(() => {
    let isCancelled = false

    const generateThumbnail = async () => {
      // If slide has a background image, just use the image directly
      const backgroundImageId = getBackgroundImageId(slide)
      if (backgroundImageId) {
        if (!isCancelled) {
          // Get the proxied image URL
          const imageUrl = getProxiedImageUrlById(backgroundImageId)
          setThumbnailUrl(imageUrl)
          setIsGenerating(false)
        }
        return
      }

      // No background image, show placeholder
      if (!isCancelled) {
        setThumbnailUrl(null)
        setIsGenerating(false)
      }
    }

    generateThumbnail()

    return () => {
      isCancelled = true
    }
  }, [slide, renderKey])

  const isLoading = loading || isGenerating
  const hasImage = hasBackgroundImage(slide)

  // Convert textBoxes to overlays for rendering, or parse paraphrasedText if no textBoxes
  const textOverlays = useMemo(() => {
    // First try to use saved textBoxes
    if (slide.textBoxes && slide.textBoxes.length > 0) {
      return textBoxesToOverlays(slide.textBoxes)
    }
    // Fall back to parsing paraphrasedText
    if (slide.paraphrasedText) {
      return parseTextToOverlays(slide.paraphrasedText)
    }
    return []
  }, [slide.textBoxes, slide.paraphrasedText])

  // Get image offset from slide (mobile format)
  const imageOffsetY = (slide as any)._mobileImageOffsetY ?? 0.5

  // Check if we should show text overlays (all sizes when we have overlays and container is ready)
  const showTextOverlays = textOverlays.length > 0 && containerSize.width > 0 && hasImage

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative overflow-hidden rounded border-2 transition-all
        ${onClick ? 'hover:border-primary hover:shadow-md cursor-pointer' : 'cursor-default'}
        ${isLoading ? 'opacity-70' : ''}
        ${className}
      `}
      style={{
        width: dimensions.width,
        height: dimensions.height
      }}
      type="button"
    >
      {thumbnailUrl && !error ? (
        <>
          <img
            src={thumbnailUrl}
            alt={`Slide ${slideIndex + 1}`}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `50% ${imageOffsetY * 100}%`
            }}
            draggable={false}
          />
          {/* Text overlays - render on top of image, non-selectable */}
          {showTextOverlays && (
            <div className="absolute inset-0 pointer-events-none select-none">
              {textOverlays.map((overlay) => (
                <TextOverlayRender
                  key={overlay.id}
                  overlay={overlay}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          {error ? (
            <div className="text-center p-1">
              <span className="text-xs text-destructive">Error</span>
            </div>
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground opacity-30" />
          )}
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Slide number badge - show in center when no background image, hide when image exists */}
      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/95 backdrop-blur-sm text-sm font-bold px-2 py-1 rounded shadow-lg text-foreground border border-border">
            {slideIndex + 1}
          </div>
        </div>
      )}
    </button>
  )
}

/**
 * Clear the global thumbnail cache
 * Useful when you want to force regeneration
 */
export function clearThumbnailCache() {
  thumbnailCache.clear()
}

/**
 * Invalidate specific slide from cache
 */
export function invalidateSlideThumbnail(slide: RemixSlideType, size?: 'sm' | 'md' | 'lg') {
  if (size) {
    const key = getSlideCacheKey(slide) + size
    thumbnailCache.delete(key)
  } else {
    // Invalidate all sizes
    const baseKey = getSlideCacheKey(slide)
    ;(['sm', 'md', 'lg'] as const).forEach(s => {
      thumbnailCache.delete(baseKey + s)
    })
  }
}
