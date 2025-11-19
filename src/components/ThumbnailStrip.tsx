'use client'

import { useState } from 'react'
import { SlideThumbnail } from './SlideThumbnail'
import { AssetPicker, AssetItem } from './AssetPicker'
import type { RemixSlideType } from '@/lib/validations/remix-schema'

interface ThumbnailStripProps {
  slides: RemixSlideType[]
  onSlideClick?: (slideIndex: number) => void
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  draftId?: string
  onBackgroundImageSelect?: (slideIndex: number, asset: AssetItem) => void
}

export function ThumbnailStrip({
  slides,
  onSlideClick,
  loading = false,
  size = 'sm',
  className = '',
  draftId,
  onBackgroundImageSelect
}: ThumbnailStripProps) {
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null)

  // Helper to check if slide has a background image
  const hasBackgroundImage = (slide: RemixSlideType): boolean => {
    return slide.backgroundLayers?.some(layer => layer.type === 'image' && layer.cacheAssetId) || false
  }

  const handleThumbnailClick = (slideIndex: number) => {
    const slide = slides[slideIndex]

    // If no background image and we have draftId, open asset picker
    if (!hasBackgroundImage(slide) && draftId) {
      setSelectedSlideIndex(slideIndex)
      setAssetPickerOpen(true)
    } else if (onSlideClick) {
      // Otherwise use the default slide click handler
      onSlideClick(slideIndex)
    }
  }

  const handleAssetSelect = (asset: AssetItem) => {
    if (selectedSlideIndex !== null && onBackgroundImageSelect) {
      onBackgroundImageSelect(selectedSlideIndex, asset)
    }
    setAssetPickerOpen(false)
    setSelectedSlideIndex(null)
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
      <div className={`flex gap-1 overflow-x-auto scrollbar-hide ${className}`}>
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

      {/* Asset Picker Dialog */}
      {draftId && (
        <AssetPicker
          open={assetPickerOpen}
          onClose={() => {
            setAssetPickerOpen(false)
            setSelectedSlideIndex(null)
          }}
          onSelect={handleAssetSelect}
          title="Choose Background Image"
          description="Select an image from your assets or upload new ones"
        />
      )}
    </>
  )
}
