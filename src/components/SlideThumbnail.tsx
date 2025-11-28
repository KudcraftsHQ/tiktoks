'use client'

import { useState, useEffect, useMemo } from 'react'
import { ImageIcon } from 'lucide-react'
import type { RemixSlideType } from '@/lib/validations/remix-schema'
import { renderSlideToDataURL, getSlideCacheKey, THUMBNAIL_SIZES, type ThumbnailDimensions } from '@/lib/slide-renderer'
import { getProxiedImageUrlById } from '@/lib/image-proxy'

interface SlideThumbnailProps {
  slide: RemixSlideType
  slideIndex: number
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
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

// Global thumbnail cache to avoid re-rendering
const thumbnailCache = new Map<string, string>()

export function SlideThumbnail({
  slide,
  slideIndex,
  loading = false,
  size = 'sm',
  onClick,
  className = ''
}: SlideThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(false)

  const dimensions: ThumbnailDimensions = THUMBNAIL_SIZES[size]
  const cacheKey = useMemo(() => getSlideCacheKey(slide) + size, [slide, size])

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
  }, [slide])

  const isLoading = loading || isGenerating
  const hasImage = hasBackgroundImage(slide)

  return (
    <button
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
        <img
          src={thumbnailUrl}
          alt={`Slide ${slideIndex + 1}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
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
