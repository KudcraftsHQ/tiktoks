'use client'

import { useState } from 'react'
import { ImageIcon, Pencil } from 'lucide-react'
import { SlideThumbnail } from './SlideThumbnail'
import { AssetPicker, AssetItem, SlideAssignment } from './AssetPicker'
import { cn } from '@/lib/utils'
import type { RemixSlideType } from '@/lib/validations/remix-schema'

interface ThumbnailStripProps {
  slides: RemixSlideType[]
  onSlideClick?: (slideIndex: number) => void
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  draftId?: string
  onBulkBackgroundImageSelect?: (assignments: { slideIndex: number; asset: AssetItem | null }[]) => void
  onEditSlide?: (slideIndex: number) => void
}

export function ThumbnailStrip({
  slides,
  onSlideClick,
  loading = false,
  size = 'sm',
  className = '',
  draftId,
  onBulkBackgroundImageSelect,
  onEditSlide
}: ThumbnailStripProps) {
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [initialActiveSlide, setInitialActiveSlide] = useState<number>(0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Helper to check if slide has a background image
  const hasBackgroundImage = (slide: RemixSlideType): boolean => {
    return slide.backgroundLayers?.some(layer => layer.type === 'image' && layer.cacheAssetId) || false
  }

  const handleImageClick = (e: React.MouseEvent, slideIndex: number) => {
    e.stopPropagation()
    // If we have draftId and bulk handler, open asset picker in slide mode
    if (draftId && onBulkBackgroundImageSelect) {
      setInitialActiveSlide(slideIndex)
      setAssetPickerOpen(true)
    } else if (onSlideClick) {
      // Otherwise use the default slide click handler
      onSlideClick(slideIndex)
    }
  }

  const handleEditClick = (e: React.MouseEvent, slideIndex: number) => {
    e.stopPropagation()
    if (onEditSlide) {
      onEditSlide(slideIndex)
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
            const isHovered = hoveredIndex === index
            const showActions = draftId && (onBulkBackgroundImageSelect || onEditSlide)

            return (
              <div
                key={slide.id}
                className="flex-shrink-0 relative group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Thumbnail */}
                <SlideThumbnail
                  slide={slide}
                  slideIndex={index}
                  loading={loading}
                  size={size}
                />

                {/* Dashed border when no background image */}
                {!hasImage && draftId && (
                  <div className="absolute inset-0 bg-background/60 border-2 border-dashed border-border rounded pointer-events-none" />
                )}

                {/* Hover action bar - slides up from bottom */}
                {showActions && (
                  <div
                    className={cn(
                      'absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1',
                      'bg-gradient-to-t from-black/80 to-transparent',
                      'rounded-b transition-all duration-200 ease-out',
                      isHovered
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2 pointer-events-none'
                    )}
                  >
                    {/* Image picker button */}
                    {onBulkBackgroundImageSelect && (
                      <button
                        onClick={(e) => handleImageClick(e, index)}
                        className={cn(
                          'p-1.5 rounded-md bg-white/20 hover:bg-white/40',
                          'text-white transition-all duration-150',
                          'hover:scale-110 active:scale-95'
                        )}
                        title="Change background image"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Edit text/position button */}
                    {onEditSlide && (
                      <button
                        onClick={(e) => handleEditClick(e, index)}
                        className={cn(
                          'p-1.5 rounded-md bg-white/20 hover:bg-white/40',
                          'text-white transition-all duration-150',
                          'hover:scale-110 active:scale-95'
                        )}
                        title="Edit text & position"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
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
