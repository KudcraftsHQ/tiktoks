'use client'

import { useState, useEffect, useMemo } from 'react'
import { ImageIcon } from 'lucide-react'
import type { RemixSlideType } from '@/lib/validations/remix-schema'
import { renderSlideToDataURL, getSlideCacheKey, THUMBNAIL_SIZES, type ThumbnailDimensions } from '@/lib/slide-renderer'

interface SlideThumbnailProps {
  slide: RemixSlideType
  slideIndex: number
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
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
      // Check cache first
      if (thumbnailCache.has(cacheKey)) {
        if (!isCancelled) {
          setThumbnailUrl(thumbnailCache.get(cacheKey)!)
        }
        return
      }

      setIsGenerating(true)
      setError(false)

      try {
        const dataUrl = await renderSlideToDataURL(slide, dimensions)

        if (!isCancelled) {
          thumbnailCache.set(cacheKey, dataUrl)
          setThumbnailUrl(dataUrl)
        }
      } catch (err) {
        console.error('Failed to generate thumbnail:', err)
        if (!isCancelled) {
          setError(true)
        }
      } finally {
        if (!isCancelled) {
          setIsGenerating(false)
        }
      }
    }

    generateThumbnail()

    return () => {
      isCancelled = true
    }
  }, [cacheKey, slide, dimensions])

  const isLoading = loading || isGenerating

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

      {/* Slide number badge */}
      <div className="absolute top-0.5 right-0.5 bg-background/90 text-[9px] font-medium px-1 rounded-bl text-foreground">
        {slideIndex + 1}
      </div>
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
