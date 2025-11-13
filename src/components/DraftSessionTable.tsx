'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'sonner'
import { createDraftTableColumns, DraftTableRow } from '@/components/draft-table-columns'
import { ImageGallery } from '@/components/ImageGallery'
import {
  Loader2,
  FileText
} from 'lucide-react'
import type { RemixPost } from '@/types/remix'
import type { TikTokPost } from '@/components/posts-table-columns'
import { Badge } from '@/components/ui/badge'

interface DraftSessionTableProps {
  referencePosts: any[] // TikTok posts used as reference
  drafts: RemixPost[]
  isLoading?: boolean
  onRefetch?: () => void
}

// Extended type that includes both reference posts and drafts
interface UnifiedTableRow extends DraftTableRow {
  _rowType: 'reference' | 'draft'
}

export function DraftSessionTable({
  referencePosts,
  drafts,
  isLoading = false,
  onRefetch
}: DraftSessionTableProps) {
  const router = useRouter()
  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; width: number; height: number }>>([])
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)

  const handleOpenImageGallery = (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => {
    setGalleryImages(images)
    setGalleryInitialIndex(initialIndex)
    setShowGallery(true)
  }

  const updateSlideText = async (
    remixId: string,
    slideIndex: number,
    newValue: string
  ) => {
    try {
      const remix = drafts.find(r => r.id === remixId)
      if (!remix) throw new Error('Remix not found')

      const updatedSlides = remix.slides.map((slide, index) =>
        index === slideIndex
          ? { ...slide, paraphrasedText: newValue }
          : slide
      )

      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: updatedSlides })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success('Saved')

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      console.error('Update failed:', error)
      throw error
    }
  }

  const updateDescription = async (
    remixId: string,
    newDescription: string
  ) => {
    try {
      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDescription })
      })

      if (!response.ok) throw new Error('Failed to update description')

      toast.success('Description saved')

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      console.error('Failed to update description:', error)
      toast.error('Failed to update description')
      throw error
    }
  }

  const deleteDraft = async (draftId: string) => {
    if (!confirm('Delete this draft?')) return

    try {
      const response = await fetch(`/api/remixes/${draftId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success('Draft deleted')

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete draft')
    }
  }

  const editDraft = (draftId: string) => {
    router.push(`/remix/${draftId}/edit`)
  }

  // Convert reference posts to draft format for unified display
  const referencePostsAsDrafts = useMemo(() => {
    return referencePosts.map((post: any) => {
      const images = Array.isArray(post.images) ? post.images : []

      // Extract OCR text - handle both formats (imageIndex and cacheAssetId)
      let ocrTexts: Record<number, string> = {}
      if (post.ocrTexts) {
        // Parse ocrTexts if it's a string (sometimes comes as JSON string)
        let parsedOcrTexts = post.ocrTexts
        if (typeof post.ocrTexts === 'string') {
          try {
            parsedOcrTexts = JSON.parse(post.ocrTexts)
          } catch (e) {
            console.error('Failed to parse ocrTexts:', e)
            parsedOcrTexts = []
          }
        }

        if (Array.isArray(parsedOcrTexts)) {
          parsedOcrTexts.forEach((item: any) => {
            // New format uses imageIndex
            if (typeof item.imageIndex === 'number' && item.text) {
              ocrTexts[item.imageIndex] = item.text
            }
            // Legacy format used cacheAssetId - keep for backward compatibility
            else if (item.cacheAssetId && item.text) {
              // Find matching image index
              const imageIndex = images.findIndex((img: any) => img.cacheAssetId === item.cacheAssetId)
              if (imageIndex !== -1) {
                ocrTexts[imageIndex] = item.text
              }
            }
          })
        }
      }

      // Create slides from images with OCR text
      const slides = images.map((img: any, index: number) => {
        const text = ocrTexts[index] || ''

        return {
          id: `${post.id}-slide-${index}`,
          displayOrder: index,
          paraphrasedText: text,
          originalText: '',
          canvas: { width: 1080, height: 1920, unit: 'px' },
          backgroundLayers: [],
          textBoxes: [],
          viewport: { zoom: 1, offsetX: 0, offsetY: 0 }
        }
      })

      // Convert slide classifications if available
      const slideClassifications = Array.isArray(post.slideClassifications)
        ? post.slideClassifications
        : []

      return {
        id: `ref-${post.id}`,
        name: `Reference: ${post.authorHandle || 'Unknown'}`,
        description: post.description || '',
        generationType: 'reference',
        sourcePostIds: [post.id],
        languageStyleTags: [],
        isDraft: false,
        bookmarked: false,
        isApproved: false,
        postedUrl: post.tiktokUrl,
        createdAt: post.publishedAt,
        updatedAt: post.updatedAt,
        slides,
        slideClassifications,
        _rowType: 'reference' as const,
        _referencePost: post // Store original post data for rendering
      }
    })
  }, [referencePosts])

  // Transform draft RemixPost data to table rows (will add _slideColumns later)
  const draftsAsTableRows = useMemo(() => {
    return drafts.map(draft => ({
      ...draft,
      _rowType: 'draft' as const
    }))
  }, [drafts])

  // Combine reference posts and drafts
  const allRows: UnifiedTableRow[] = useMemo(() => {
    const maxSlides = Math.max(
      ...referencePostsAsDrafts.map(r => r.slides.length),
      ...draftsAsTableRows.map(r => r.slides.length),
      0
    )

    const referenceRows = referencePostsAsDrafts.map(ref => ({
      ...ref,
      _slideColumns: Array.from({ length: maxSlides }, (_, index) => {
        const slide = ref.slides[index]
        const classification = ref.slideClassifications?.[index]

        return {
          slideIndex: index,
          text: slide?.paraphrasedText || '',
          classification: classification?.type
        }
      })
    }))

    const draftRows = draftsAsTableRows.map(draft => ({
      ...draft,
      _slideColumns: Array.from({ length: maxSlides }, (_, index) => {
        const slide = draft.slides[index]
        const classification = draft.slideClassifications?.[index]

        return {
          slideIndex: index,
          text: slide?.paraphrasedText || '',
          classification: classification?.type
        }
      })
    }))

    return [...referenceRows, ...draftRows]
  }, [referencePostsAsDrafts, draftsAsTableRows])

  // Create columns with handlers
  const columns = useMemo(() => {
    return createDraftTableColumns({
      onUpdateSlideText: updateSlideText,
      onUpdateDescription: updateDescription,
      onDeleteDraft: deleteDraft,
      onEditDraft: editDraft,
      onRefetch: onRefetch || (() => {}),
      onOpenImageGallery: handleOpenImageGallery
    })
  }, [onRefetch, updateSlideText, updateDescription, deleteDraft, editDraft, handleOpenImageGallery])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (allRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 opacity-50" />
          </div>
          <h3 className="font-medium mb-2">No content yet</h3>
          <p className="text-sm text-muted-foreground">
            Generate content to see drafts here
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex flex-col min-h-0">
        <DataTable
          columns={columns}
          data={allRows}
          enablePagination={false}
        />
      </div>

      {/* Image Gallery */}
      <ImageGallery
        isOpen={showGallery}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        onClose={() => setShowGallery(false)}
      />
    </>
  )
}
