'use client'

import { useState } from 'react'
import { SlideThumbnail } from './SlideThumbnail'
import { AssetPicker, AssetItem, SlideAssignment } from './AssetPicker'
import type { RemixSlideType } from '@/lib/validations/remix-schema'

interface ThumbnailStripProps {
  slides: RemixSlideType[]
  onSlideClick?: (slideIndex: number) => void
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  draftId?: string
  onBulkBackgroundImageSelect?: (assignments: { slideIndex: number; asset: AssetItem | null }[]) => void
}

export function ThumbnailStrip({
  slides,
  onSlideClick,
  loading = false,
  size = 'sm',
  className = '',
  draftId,
  onBulkBackgroundImageSelect
}: ThumbnailStripProps) {
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [initialActiveSlide, setInitialActiveSlide] = useState<number>(0)

  // Helper to check if slide has a background image
  const hasBackgroundImage = (slide: RemixSlideType): boolean => {
    return slide.backgroundLayers?.some(layer => layer.type === 'image' && layer.cacheAssetId) || false
  }

  const handleThumbnailClick = (slideIndex: number) => {
    // If we have draftId and bulk handler, open asset picker in slide mode
    if (draftId && onBulkBackgroundImageSelect) {
      setInitialActiveSlide(slideIndex)
      setAssetPickerOpen(true)
    } else if (onSlideClick) {
      // Otherwise use the default slide click handler
      onSlideClick(slideIndex)
    }
  }

  const handleSlideAssignments = (assignments: SlideAssignment[]) => {
    if (onBulkBackgroundImageSelect) {
      onBulkBackgroundImageSelect(assignments)
    }
    setAssetPickerOpen(false)
  }

  if (!slides || slides.length === 0) {
    return (
      <div className={`flex gap-1 ${className}`}>
        <div className="w-12 h-[85px] rounded border-2 border-dashed bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Empty</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {slides.map((slide, index) => {
            const hasImage = hasBackgroundImage(slide)

            return (
              <div key={slide.id} className="flex-shrink-0 relative group">
                <SlideThumbnail
                  slide={slide}
                  slideIndex={index}
                  loading={loading}
                  size={size}
                  onClick={() => handleThumbnailClick(index)}
                />
                {/* Show dashed border when no background image and asset picker is available */}
                {!hasImage && draftId && (
                  <div className="absolute inset-0 bg-background/60 border-2 border-dashed border-border rounded pointer-events-none" />
                )}
              </div>
            )
          })}
        </div>

      </div>

      {/* Asset Picker Dialog - using slideMode for slide-aware assignment */}
      {draftId && (
        <AssetPicker
          open={assetPickerOpen}
          onClose={() => setAssetPickerOpen(false)}
          onSlideAssignments={handleSlideAssignments}
          title="Select Background Images"
          description="Click a slide to target it, then pick an image. Click images to assign/unassign."
          slideMode={{
            slides,
            initialActiveSlideIndex: initialActiveSlide
          }}
        />
      )}
    </>
  )
}
