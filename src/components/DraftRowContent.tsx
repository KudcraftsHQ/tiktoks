'use client'

import { useState, useCallback, useRef } from 'react'
import { ThumbnailStrip } from './ThumbnailStrip'
import { SlideGrid } from './SlideGrid'
import { invalidateSlideThumbnail } from './SlideThumbnail'
import type { RemixPost } from '@/types/remix'
import type { RemixSlideType } from '@/lib/validations/remix-schema'
import { toast } from 'sonner'

interface DraftRowContentProps {
  draft: RemixPost
  onSlideEditClick: (draftId: string, slideIndex: number) => void
  onSlideUpdate?: (draftId: string, slideIndex: number, updates: RemixSlideType) => Promise<void>
  onRefetchData?: () => void
}

export function DraftRowContent({
  draft,
  onSlideEditClick,
  onSlideUpdate,
  onRefetchData
}: DraftRowContentProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Parse slides safely
  const slides = draft.slides && Array.isArray(draft.slides)
    ? draft.slides as RemixSlideType[]
    : []

  // Debounced save function
  const debouncedSave = useCallback(async (slideIndex: number, newText: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        // Update the slide text in the database
        const updatedSlides = [...slides]
        if (updatedSlides[slideIndex]) {
          updatedSlides[slideIndex] = {
            ...updatedSlides[slideIndex],
            paraphrasedText: newText,
            // Also update the first text box if it exists
            textBoxes: updatedSlides[slideIndex].textBoxes?.map((tb, i) =>
              i === 0 ? { ...tb, text: newText } : tb
            ) || []
          }

          // Save to API
          const response = await fetch(`/api/remixes/${draft.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              slides: updatedSlides
            })
          })

          if (!response.ok) {
            throw new Error('Failed to save slide')
          }

          // Invalidate thumbnail cache for this slide
          invalidateSlideThumbnail(updatedSlides[slideIndex])

          // Refetch data to update thumbnails
          if (onRefetchData) {
            onRefetchData()
          }
        }
      } catch (error) {
        console.error('Failed to save slide:', error)
        toast.error('Failed to save changes')
      } finally {
        setIsSaving(false)
      }
    }, 1000) // 1 second debounce
  }, [draft.id, slides, onRefetchData])

  const handleSlideTextChange = useCallback((slideIndex: number, newText: string) => {
    debouncedSave(slideIndex, newText)
  }, [debouncedSave])

  const handleSlideEditClick = useCallback((slideIndex: number) => {
    onSlideEditClick(draft.id, slideIndex)
  }, [draft.id, onSlideEditClick])

  const handleThumbnailClick = useCallback((slideIndex: number) => {
    onSlideEditClick(draft.id, slideIndex)
  }, [draft.id, onSlideEditClick])

  return (
    <div className="space-y-3">
      {/* Author Column Content: Thumbnail Strip + Metadata */}
      <div className="flex flex-col gap-2">
        {/* Thumbnail Strip */}
        <ThumbnailStrip
          slides={slides}
          onSlideClick={handleThumbnailClick}
          loading={isSaving}
          size="sm"
        />

        {/* Metadata */}
        <div className="text-sm space-y-0.5">
          <div className="font-medium text-foreground">Draft</div>
          <div className="text-muted-foreground truncate max-w-[200px]">
            {draft.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(draft.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Content Column Content: Slide Grid */}
      <div className="border-t pt-3">
        <SlideGrid
          slides={slides}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onSlideTextChange={handleSlideTextChange}
          onSlideEditClick={handleSlideEditClick}
        />
      </div>
    </div>
  )
}
