'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { createPostsTableColumns, TikTokPost } from '@/components/posts-table-columns'
import { ImageGallery } from '@/components/ImageGallery'
import { getProxiedImageUrlById } from '@/lib/image-proxy'
import { PostAnalyticsSheet } from '@/components/PostAnalyticsSheet'
import { ThumbnailStrip } from '@/components/ThumbnailStrip'
import { invalidateSlideThumbnail } from '@/components/SlideThumbnail'
import { DraftSettingsDialog } from '@/components/DraftSettingsDialog'
import type { RemixSlideType } from '@/lib/validations/remix-schema'
import { SortingState, RowSelectionState } from '@tanstack/react-table'
import { FileText, Loader2, Sparkles, Edit, ExternalLink, Trash2, Copy, Plus, X, GripVertical, Settings, Download } from 'lucide-react'
import { toast } from 'sonner'
import { DateRange } from '@/components/DateRangeFilter'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { RemixPost } from '@/types/remix'
import { InlineEditableText } from '@/components/InlineEditableText'
import { RemixSlideTypeDropdown } from '@/components/RemixSlideTypeDropdown'
import { InlineCategorySelector } from '@/components/InlineCategorySelector'
import { SlideTypeDropdown } from '@/components/SlideTypeDropdown'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { Star } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

// Extended type that can be either a TikTok post or a RemixPost draft
export type ProjectTableRow = (TikTokPost & {
  _rowType: 'post'
}) | (RemixPost & {
  _rowType: 'draft'
})

// Sortable Slide Component for drag-and-drop
interface SortableSlideProps {
  id: string
  slide: any
  slideIndex: number
  draftId: string
  classification: any
  searchTerms: string[]
  onSaveText: (draftId: string, slideIndex: number, newText: string) => Promise<void>
  onRemoveSlide: (draftId: string, slideIndex: number) => Promise<void>
  onRefetchData?: () => void
  totalSlides: number
}

function SortableSlide({
  id,
  slide,
  slideIndex,
  draftId,
  classification,
  searchTerms,
  onSaveText,
  onRemoveSlide,
  onRefetchData,
  totalSlides
}: SortableSlideProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-slide-id={id}
      className={cn(
        'flex-shrink-0 w-52 flex flex-col',
        isDragging && 'z-50'
      )}
    >
      {/* Slide header with drag handle, number badge, type, and remove button */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded">
          Slide {slideIndex + 1}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RemixSlideTypeDropdown
            remixId={draftId}
            slideIndex={slideIndex}
            currentType={classification?.type as 'hook' | 'content' | 'cta' | null}
            onUpdate={onRefetchData}
          />
        </div>
        {totalSlides > 1 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveSlide(draftId, slideIndex)
                }}
                className="h-6 w-6 p-0 ml-auto text-destructive hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Remove Slide</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Slide text - fixed height with scroll */}
      <div className="h-48 overflow-y-auto">
        <InlineEditableText
          value={slide.paraphrasedText || ''}
          onSave={async (newValue) => {
            await onSaveText(draftId, slideIndex, newValue)
          }}
          placeholder="No text"
          fixedHeight={true}
          heightClass="h-48"
          disabled={false}
          className="text-[12px]"
          rows={8}
          searchTerms={searchTerms}
          textBoxMode={true}
        />
      </div>
    </div>
  )
}

interface ProjectPostsTableProps {
  rows: ProjectTableRow[]
  projectId?: string // Optional project ID for removing posts from project
  totalRows?: number
  categoryFilter?: {
    value: string
    onChange: (value: string) => void
  }
  dateRangeFilter?: {
    value: DateRange
    onChange: (range: DateRange) => void
  }
  onPageChange?: (pageIndex: number, pageSize: number) => void
  onSortingChange?: (sorting: SortingState) => void
  onRefetchData?: () => void
  sorting?: SortingState
  isLoading?: boolean
  hiddenColumns?: string[]
  enableServerSideSorting?: boolean
  // Selection state (controlled from parent) - TanStack RowSelectionState
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  viewMode?: 'metrics' | 'content'
  searchQuery?: string
  rowClassName?: (row: ProjectTableRow) => string
  onPostRemoved?: (postId: string) => void
  onDraftRemoved?: (draftId: string) => void
}

export function ProjectPostsTable({
  rows,
  projectId,
  totalRows,
  categoryFilter,
  dateRangeFilter,
  onPageChange,
  onSortingChange,
  onRefetchData,
  sorting,
  isLoading,
  hiddenColumns,
  enableServerSideSorting = false,
  rowSelection,
  onRowSelectionChange,
  viewMode = 'metrics',
  searchQuery = '',
  rowClassName,
  onPostRemoved,
  onDraftRemoved
}: ProjectPostsTableProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [selectedPost, setSelectedPost] = useState<TikTokPost | null>(null)
  const [analyticsPost, setAnalyticsPost] = useState<TikTokPost | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [isBulkOCRing, setIsBulkOCRing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'post' | 'draft'; name: string } | null>(null)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [selectedDraftForSettings, setSelectedDraftForSettings] = useState<{ id: string; canvasSize?: { width: number; height: number } } | null>(null)

  // Parse search terms from search query
  const searchTerms = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) return []
    return searchQuery
      .split(/\s+/)
      .map(term => term.trim())
      .filter(term => term.length >= 2)
  }, [searchQuery])

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})

  // Local state for optimistic updates on draft rows
  const [optimisticRows, setOptimisticRows] = useState<ProjectTableRow[]>([])

  // Use optimistic rows if available, otherwise use props rows
  const displayRows = optimisticRows.length > 0 ? optimisticRows : rows

  // Update optimistic rows when props rows change
  useEffect(() => {
    setOptimisticRows(rows)
  }, [rows])

  // Extract only posts for compatibility
  const posts = useMemo(() => {
    return displayRows.filter((row): row is TikTokPost & { _rowType: 'post' } => row._rowType === 'post')
  }, [displayRows])

  // Use a stable cache to store proxied URLs by cache asset IDs
  // This ensures URLs never change, even when underlying R2 URLs change
  const urlCacheRef = useRef<Map<string, string>>(new Map())

  // Helper to get stable proxy URL from cache asset ID
  const getStableProxyUrl = (cacheAssetId: string | null | undefined): string => {
    if (!cacheAssetId) return ''

    // Check cache first
    const cached = urlCacheRef.current.get(cacheAssetId)
    if (cached) return cached

    // Generate and cache
    const url = getProxiedImageUrlById(cacheAssetId)
    urlCacheRef.current.set(cacheAssetId, url)
    return url
  }

  // Memoize rows with stable proxy URLs using cache asset IDs
  const rowsWithProxiedUrls = useMemo(() => {
    return displayRows.map(row => {
      if (row._rowType === 'post') {
        return {
          ...row,
          _proxiedAuthorAvatar: getStableProxyUrl(row.authorAvatarId),
          _proxiedCoverUrl: getStableProxyUrl(row.coverId),
          _proxiedImages: row.images?.map(img => ({
            ...img,
            _proxiedUrl: getStableProxyUrl(img.cacheAssetId)
          }))
        }
      }
      // For drafts, no proxying needed yet
      return row
    })
  }, [displayRows])

  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; width: number; height: number }>>([])
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString)
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    )
  }, [])

  // Memoize all handlers to prevent columns regeneration
  const handlePreviewPost = useCallback((post: TikTokPost) => {
    setSelectedPost(post)
  }, [])

  const handleOpenImageGallery = useCallback((images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => {
    setGalleryImages(images)
    setGalleryInitialIndex(initialIndex)
    setShowGallery(true)
  }, [])

  const handleRemixPost = useCallback((post: TikTokPost) => {
    window.open(`/posts/${post.id}/remix`, '_blank')
  }, [])

  const handleRowClick = useCallback((post: any) => {
    // Only open analytics for posts, not drafts
    if (post._rowType === 'post') {
      setAnalyticsPost(post)
      setShowAnalytics(true)
    } else if (post._rowType === 'draft') {
      // Open draft in edit mode
      window.open(`/remix/${post.id}/edit`, '_blank')
    }
  }, [])

  const handleTriggerOCR = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/tiktok/posts/${postId}/process`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to process post')
      }

      toast.success('OCR and classification processing started')
    } catch (err) {
      console.error('Failed to process post:', err)
      toast.error('Failed to start OCR and classification processing')
      throw err
    }
  }, [])


  const handleDeleteClick = useCallback((id: string, type: 'post' | 'draft', name: string) => {
    setItemToDelete({ id, type, name })
    setDeleteDialogOpen(true)
  }, [])

  // Handler to copy a single draft to clipboard
  const handleCopyDraftToClipboard = useCallback(async (draft: RemixPost) => {
    try {
      const sections: string[] = []

      // Draft name as H1
      sections.push(`# ${draft.name}`)
      sections.push('')

      // Description
      if (draft.description) {
        sections.push('## Description')
        sections.push('')
        sections.push(draft.description)
        sections.push('')
      }

      // Slides
      if (draft.slides && draft.slides.length > 0) {
        sections.push('## Content')
        sections.push('')

        draft.slides.forEach((slide, slideIndex) => {
          // Get slide classification
          const classification = draft.slideClassifications?.find(c => c.slideIndex === slideIndex)
          const slideType = classification?.type || 'unknown'

          sections.push(`### Slide ${slideIndex + 1} - ${slideType}`)
          sections.push('')
          sections.push(slide.paraphrasedText || '')
          sections.push('')
        })
      }

      const markdownContent = sections.join('\n')

      // Copy to clipboard
      await navigator.clipboard.writeText(markdownContent)

      toast.success('Draft copied to clipboard', {
        description: 'Content is ready to paste'
      })
    } catch (error) {
      console.error('Failed to copy draft to clipboard:', error)
      toast.error('Failed to copy to clipboard', {
        description: 'Please try again'
      })
    }
  }, [])

  // Handler to open settings dialog
  const handleSettingsClick = useCallback((draft: RemixPost) => {
    setSelectedDraftForSettings({
      id: draft.id,
      canvasSize: draft.canvasSize as { width: number; height: number } | undefined
    })
    setSettingsDialogOpen(true)
  }, [])

  // Handler to download draft as ZIP
  const handleDownloadDraft = useCallback(async (draft: RemixPost) => {
    try {
      toast.info('Generating export...', {
        description: 'This may take a moment'
      })

      const response = await fetch(`/api/remixes/${draft.id}/export`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate export')
      }

      const result = await response.json()

      // Download the file
      const link = document.createElement('a')
      link.href = result.downloadUrl
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Export ready', {
        description: `${result.slideCount} slides, ${result.imageCount} images`
      })
    } catch (error) {
      console.error('Failed to download draft:', error)
      toast.error('Failed to generate export', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    }
  }, [])

  // Handler to update post description
  const handleSavePostDescription = useCallback(async (postId: string, newDescription: string) => {
    try {
      const response = await fetch(`/api/tiktok/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: newDescription
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update description')
      }

      toast.success('Description updated')
    } catch (error) {
      console.error('Failed to update description:', error)
      toast.error('Failed to update description')
      throw error
    }
  }, [])

  // Handler to update draft description
  const handleSaveDraftDescription = useCallback(async (draftId: string, newDescription: string) => {
    try {
      const response = await fetch(`/api/remixes/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: newDescription
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update draft description')
      }

      toast.success('Draft description updated')
    } catch (error) {
      console.error('Failed to update draft description:', error)
      toast.error('Failed to update draft description')
      throw error
    }
  }, [])

  // Handler to update draft name/title
  const handleSaveDraftName = useCallback(async (draftId: string, newName: string) => {
    try {
      const response = await fetch(`/api/remixes/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update draft name')
      }

      toast.success('Draft name updated')
    } catch (error) {
      console.error('Failed to update draft name:', error)
      toast.error('Failed to update draft name')
      throw error
    }
  }, [])

  // Helper to safely get slides array from draft row
  const getSlidesArray = useCallback((slides: any): any[] => {
    try {
      return typeof slides === 'string'
        ? JSON.parse(slides)
        : (Array.isArray(slides) ? slides : [])
    } catch {
      return []
    }
  }, [])

  // Handler to update draft slide text
  const handleSaveDraftSlideText = useCallback(async (draftId: string, slideIndex: number, newText: string) => {
    // Find the draft to get current slide data
    const draftIndex = displayRows.findIndex(r => r.id === draftId && r._rowType === 'draft')
    if (draftIndex === -1) return

    const draft = displayRows[draftIndex] as RemixPost & { _rowType: 'draft' }
    const slides = getSlidesArray(draft.slides)
    const currentSlide = slides[slideIndex]
    if (!currentSlide) return

    // Split newText by newlines to create textBoxes array
    const textLines = newText.split('\n').filter(line => line.trim() !== '')

    // Create textBoxes from lines, preserving existing textBox properties or creating new ones
    const updatedTextBoxes = textLines.map((line, index) => {
      const existingTextBox = currentSlide.textBoxes?.[index]

      if (existingTextBox) {
        // Update existing text box
        return {
          ...existingTextBox,
          text: line
        }
      } else {
        // Create new text box with default properties
        return {
          id: `text_${Date.now()}_${index}`,
          text: line,
          x: 0.1,
          y: 0.3 + (index * 0.15), // Stack vertically
          width: 0.8,
          height: 0.12,
          fontSize: 44,
          fontFamily: 'Poppins',
          fontWeight: 'bold' as const,
          color: '#000000',
          textAlign: 'center' as const,
          backgroundColor: '#ffffff',
          backgroundOpacity: 1,
          borderRadius: 12,
          paddingTop: 24,
          paddingRight: 32,
          paddingBottom: 24,
          paddingLeft: 32,
          lineHeight: 1.2,
          zIndex: index
        }
      }
    })

    // Optimistically update the UI
    const updatedSlides = [...slides]
    updatedSlides[slideIndex] = {
      ...currentSlide,
      paraphrasedText: newText,
      textBoxes: updatedTextBoxes
    }

    console.log('Saving slide with textBoxes:', updatedTextBoxes.map(tb => ({ text: tb.text })))

    const updatedDraft = {
      ...draft,
      slides: updatedSlides
    }

    const updatedRows = [...displayRows]
    updatedRows[draftIndex] = updatedDraft
    setOptimisticRows(updatedRows)

    // Invalidate thumbnail cache for this slide
    invalidateSlideThumbnail(updatedSlides[slideIndex])

    try {
      const response = await fetch(`/api/remixes/${draftId}/slides/${slideIndex}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paraphrasedText: newText,
          textBoxes: updatedTextBoxes
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update slide text')
      }

      // Trigger data refetch to update thumbnails
      if (onRefetchData) {
        onRefetchData()
      }

      toast.success('Slide text updated')
    } catch (error) {
      console.error('Failed to update slide text:', error)
      toast.error('Failed to update slide text')

      // Revert optimistic update
      setOptimisticRows(rows)
      throw error
    }
  }, [displayRows, getSlidesArray, onRefetchData, rows])

  // Handler to add a new slide to a draft
  const handleAddSlide = useCallback(async (draftId: string) => {
    // Find the draft in current rows
    const draftIndex = displayRows.findIndex(row => row.id === draftId && row._rowType === 'draft')
    if (draftIndex === -1) return

    const draft = displayRows[draftIndex] as RemixPost & { _rowType: 'draft' }

    // Parse existing slides
    let existingSlides = getSlidesArray(draft.slides)

    // Create new slide optimistically
    const newSlideIndex = existingSlides.length
    const newSlide = {
      id: `slide_${Date.now()}_${newSlideIndex}`,
      displayOrder: newSlideIndex,
      canvas: { width: 1080, height: 1920 },
      viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      backgroundLayers: [],
      originalImageIndex: newSlideIndex,
      paraphrasedText: '',
      originalText: '',
      textBoxes: []
    }

    // Optimistically update UI
    const updatedSlides = [...existingSlides, newSlide]
    const updatedDraft = {
      ...draft,
      slides: updatedSlides
    }
    const updatedRows = [...displayRows]
    updatedRows[draftIndex] = updatedDraft
    setOptimisticRows(updatedRows)

    // Focus on the new slide's textarea after DOM update
    setTimeout(() => {
      // Find the slide by its unique ID in the DOM
      const slideId = `${draftId}-slide-${newSlideIndex}`
      const slideElement = document.querySelector(`[data-slide-id="${slideId}"]`)

      if (slideElement) {
        // Scroll the slide into view
        slideElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })

        // Find and focus the textarea within this slide
        const textarea = slideElement.querySelector('textarea') as HTMLTextAreaElement
        if (textarea) {
          setTimeout(() => {
            textarea.focus()
            textarea.select()
          }, 300) // Wait for smooth scroll to complete
        }
      }
    }, 50) // Small delay to allow DOM to update

    try {
      const response = await fetch(`/api/remixes/${draftId}/add-slide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to add slide')
      }

      const result = await response.json()
      toast.success('Slide added')

      // Update optimistic state with server response to ensure consistency
      // The optimistic update is already applied, just keep it
    } catch (error) {
      console.error('Failed to add slide:', error)
      toast.error('Failed to add slide')

      // Revert optimistic update
      setOptimisticRows(rows)
    }
  }, [displayRows, rows, getSlidesArray])

  // Handler to remove a slide from a draft
  const handleRemoveSlide = useCallback(async (draftId: string, slideIndex: number) => {
    // Find the draft in current rows
    const draftIndex = displayRows.findIndex(row => row.id === draftId && row._rowType === 'draft')
    if (draftIndex === -1) return

    const draft = displayRows[draftIndex] as RemixPost & { _rowType: 'draft' }

    // Parse existing slides
    let existingSlides = getSlidesArray(draft.slides)

    // Check if we can remove (must have at least 1 slide)
    if (existingSlides.length <= 1) {
      toast.error('Cannot remove the last slide')
      return
    }

    // Optimistically update UI
    const updatedSlides = existingSlides.filter((_, index) => index !== slideIndex)
    const updatedDraft = {
      ...draft,
      slides: updatedSlides
    }
    const updatedRows = [...displayRows]
    updatedRows[draftIndex] = updatedDraft
    setOptimisticRows(updatedRows)

    try {
      const response = await fetch(`/api/remixes/${draftId}/remove-slide`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slideIndex })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove slide')
      }

      toast.success('Slide removed')

      // Keep the optimistic update, no need to refetch
    } catch (error) {
      console.error('Failed to remove slide:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove slide')

      // Revert optimistic update
      setOptimisticRows(rows)
    }
  }, [displayRows, rows, getSlidesArray])

  // Handler to toggle bookmark status for a draft
  const handleToggleBookmark = useCallback(async (draftId: string, currentBookmarked: boolean) => {
    // Find the draft in current rows
    const draftIndex = displayRows.findIndex(row => row.id === draftId && row._rowType === 'draft')
    if (draftIndex === -1) return

    const draft = displayRows[draftIndex] as RemixPost & { _rowType: 'draft' }

    // Optimistically update UI
    const updatedDraft = {
      ...draft,
      bookmarked: !currentBookmarked
    }
    const updatedRows = [...displayRows]
    updatedRows[draftIndex] = updatedDraft
    setOptimisticRows(updatedRows)

    try {
      const response = await fetch(`/api/remixes/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookmarked: !currentBookmarked })
      })

      if (!response.ok) {
        throw new Error('Failed to update bookmark status')
      }

      toast.success(
        !currentBookmarked ? 'Added to bookmarks' : 'Removed from bookmarks'
      )

      // Keep the optimistic update, no need to refetch
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      toast.error('Failed to update bookmark')

      // Revert optimistic update
      setOptimisticRows(rows)
    }
  }, [displayRows, rows])

  // Handler to reorder slides in a draft
  const handleReorderSlides = useCallback(async (draftId: string, slideIndices: number[]) => {
    // Find the draft in current rows
    const draftIndex = displayRows.findIndex(row => row.id === draftId && row._rowType === 'draft')
    if (draftIndex === -1) return

    const draft = displayRows[draftIndex] as RemixPost & { _rowType: 'draft' }

    // Parse existing slides
    let existingSlides = getSlidesArray(draft.slides)

    // Optimistically reorder slides
    const reorderedSlides = slideIndices.map(oldIndex => existingSlides[oldIndex])
    const updatedDraft = {
      ...draft,
      slides: reorderedSlides
    }
    const updatedRows = [...displayRows]
    updatedRows[draftIndex] = updatedDraft
    setOptimisticRows(updatedRows)

    try {
      const response = await fetch(`/api/remixes/${draftId}/reorder-slides`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slideIndices })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder slides')
      }

      // Keep the optimistic update, no need to refetch
    } catch (error) {
      console.error('Failed to reorder slides:', error)
      toast.error('Failed to reorder slides')

      // Revert optimistic update
      setOptimisticRows(rows)
    }
  }, [displayRows, rows, getSlidesArray])

  // Handler to set slide background image
  const handleSetSlideBackground = useCallback(async (draftId: string, slideIndex: number, cacheAssetId: string) => {
    // Find the draft in current rows
    const draftIndex = displayRows.findIndex(row => row.id === draftId && row._rowType === 'draft')
    if (draftIndex === -1) return

    const draft = displayRows[draftIndex] as RemixPost & { _rowType: 'draft' }

    // Parse existing slides
    let existingSlides = getSlidesArray(draft.slides)
    const currentSlide = existingSlides[slideIndex]
    if (!currentSlide) return

    // Create or update background layer with image
    const backgroundLayers = currentSlide.backgroundLayers || []
    const imageLayerIndex = backgroundLayers.findIndex(layer => layer.type === 'image')

    let updatedBackgroundLayers
    if (imageLayerIndex !== -1) {
      // Update existing image layer
      updatedBackgroundLayers = [...backgroundLayers]
      updatedBackgroundLayers[imageLayerIndex] = {
        ...updatedBackgroundLayers[imageLayerIndex],
        cacheAssetId: cacheAssetId
      }
    } else {
      // Add new image layer
      const newImageLayer = {
        id: `bg_${Date.now()}_image`,
        type: 'image' as const,
        cacheAssetId: cacheAssetId,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        fitMode: 'cover' as const,
        opacity: 1,
        blendMode: 'normal' as const,
        zIndex: 1
      }
      updatedBackgroundLayers = [newImageLayer, ...backgroundLayers]
    }

    // Optimistically update the UI
    const updatedSlides = [...existingSlides]
    updatedSlides[slideIndex] = {
      ...currentSlide,
      backgroundLayers: updatedBackgroundLayers
    }

    const updatedDraft = {
      ...draft,
      slides: updatedSlides
    }

    const updatedRows = [...displayRows]
    updatedRows[draftIndex] = updatedDraft
    setOptimisticRows(updatedRows)

    // Invalidate thumbnail cache for this slide
    invalidateSlideThumbnail(updatedSlides[slideIndex])

    try {
      const response = await fetch(`/api/remixes/${draftId}/slides/${slideIndex}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          backgroundLayers: updatedBackgroundLayers
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update slide background')
      }

      // Trigger data refetch to update thumbnails
      if (onRefetchData) {
        onRefetchData()
      }

      toast.success('Background image updated')
    } catch (error) {
      console.error('Failed to update slide background:', error)
      toast.error('Failed to update background image')

      // Revert optimistic update
      setOptimisticRows(rows)
      throw error
    }
  }, [displayRows, getSlidesArray, onRefetchData, rows])

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    try {
      if (itemToDelete.type === 'draft') {
        // Delete draft
        const response = await fetch(`/api/remixes/${itemToDelete.id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error('Failed to delete draft')
        }

        toast.success('Draft deleted successfully')

        // Clear from selection if it was selected (using TanStack RowSelectionState)
        if (rowSelection && onRowSelectionChange) {
          const rowIndex = displayRows.findIndex(r => r.id === itemToDelete.id)
          if (rowIndex !== -1 && rowSelection[rowIndex]) {
            const newSelection = { ...rowSelection }
            delete newSelection[rowIndex]
            onRowSelectionChange(newSelection)
          }
        }

        if (onDraftRemoved) {
          onDraftRemoved(itemToDelete.id)
        }
      } else {
        // Remove post from project
        if (!projectId) {
          toast.error('Project ID not provided')
          setDeleteDialogOpen(false)
          setItemToDelete(null)
          return
        }

        const response = await fetch(`/api/projects/${projectId}/posts`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            postIds: [itemToDelete.id]
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to remove post from project')
        }

        toast.success('Post removed from project')

        // Clear from selection if it was selected (using TanStack RowSelectionState)
        if (rowSelection && onRowSelectionChange) {
          const rowIndex = displayRows.findIndex(r => r.id === itemToDelete.id)
          if (rowIndex !== -1 && rowSelection[rowIndex]) {
            const newSelection = { ...rowSelection }
            delete newSelection[rowIndex]
            onRowSelectionChange(newSelection)
          }
        }

        if (onPostRemoved) {
          onPostRemoved(itemToDelete.id)
        }
      }

    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete item')
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  // Memoize row data with stable proxied URLs to prevent re-renders
  const memoizedRowsWithProxiedUrls = useMemo(() => rowsWithProxiedUrls, [rowsWithProxiedUrls])

  // Create columns - memoized with all necessary dependencies
  const columns = useMemo(() => {
    const postColumns = createPostsTableColumns({
      onPreviewPost: handlePreviewPost,
      onOpenImageGallery: handleOpenImageGallery,
      onRemixPost: handleRemixPost,
      onRowClick: handleRowClick,
      onTriggerOCR: handleTriggerOCR,
      onRefetchPosts: onRefetchData,
      viewMode,
      searchTerms
    })

    // Wrap columns to handle both posts and drafts
    return postColumns.map((col: any) => ({
      ...col,
      cell: (info: any) => {
        const row = info.row.original

        const columnId = col.id || col.accessorKey

        // For draft rows, render custom content
        if (row._rowType === 'draft') {
          // Handle specific columns for drafts
          if (columnId === 'authorHandle') {
            // Show thumbnail strip + metadata for drafts
            const slides = getSlidesArray(row.slides)
            const createdDate = new Date(row.createdAt)
            const formattedDateTime = createdDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })

            return (
              <div className="flex flex-col gap-2 min-w-[260px]" onClick={(e) => e.stopPropagation()}>
                {/* Thumbnail Strip */}
                <ThumbnailStrip
                  slides={slides}
                  size="sm"
                  draftId={row.id}
                  onBackgroundImageSelect={async (slideIndex, asset) => {
                    await handleSetSlideBackground(row.id, slideIndex, asset.cacheAssetId)
                  }}
                />

                {/* Metadata */}
                <div className="text-sm space-y-0.5">
                  <div className="font-medium text-foreground">
                    <InlineEditableText
                      value={row.name}
                      onSave={async (newValue) => {
                        await handleSaveDraftName(row.id, newValue)
                      }}
                      placeholder="Untitled Draft"
                      disabled={false}
                      className="text-sm font-medium"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formattedDateTime} • {slides.length} slides
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {row.generationType}
                    </Badge>
                    {row.productContext && (
                      <Badge variant="secondary" className="text-xs">
                        {row.productContext.title}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          } else if (columnId === 'title') {
            // Show slides for drafts (this is the Content column) - matching post column structure
            if (viewMode === 'content' && row.slides) {
              // Parse slides if they're a JSON string
              let slides: any[] = []
              try {
                slides = typeof row.slides === 'string'
                  ? JSON.parse(row.slides)
                  : (Array.isArray(row.slides) ? row.slides : [])
              } catch {
                slides = []
              }

              if (slides.length > 0) {
                // Create sortable items with unique IDs
                const sortableItems = slides.map((slide, index) => ({
                  id: `${row.id}-slide-${index}`,
                  slide,
                  index
                }))

                const sensors = useSensors(
                  useSensor(PointerSensor),
                  useSensor(KeyboardSensor, {
                    coordinateGetter: sortableKeyboardCoordinates,
                  })
                )

                const handleDragEnd = async (event: DragEndEvent) => {
                  const { active, over } = event

                  if (over && active.id !== over.id) {
                    const oldIndex = sortableItems.findIndex(item => item.id === active.id)
                    const newIndex = sortableItems.findIndex(item => item.id === over.id)

                    if (oldIndex !== -1 && newIndex !== -1) {
                      // Create new order array
                      const newOrder = arrayMove(
                        Array.from({ length: slides.length }, (_, i) => i),
                        oldIndex,
                        newIndex
                      )

                      // Call API to update order
                      await handleReorderSlides(row.id, newOrder)
                    }
                  }
                }

                return (
                  <TooltipProvider>
                    <div className="w-full">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          <SortableContext
                            items={sortableItems.map(item => item.id)}
                            strategy={horizontalListSortingStrategy}
                          >
                            {sortableItems.map(({ id, slide, index }) => {
                              const classification = row.slideClassifications?.[index]

                              return (
                                <SortableSlide
                                  key={id}
                                  id={id}
                                  slide={slide}
                                  slideIndex={index}
                                  draftId={row.id}
                                  classification={classification}
                                  searchTerms={searchTerms}
                                  onSaveText={handleSaveDraftSlideText}
                                  onRemoveSlide={handleRemoveSlide}
                                  onRefetchData={onRefetchData}
                                  totalSlides={slides.length}
                                />
                              )
                            })}
                          </SortableContext>
                          {/* Add New Slide Button */}
                          <div className="flex-shrink-0 w-52 flex flex-col">
                            {/* Empty space for alignment with slide header and description badge */}
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="h-6"></div>
                            </div>
                            {/* Add slide button - fixed height matching slide text area */}
                            <div className="h-48 overflow-y-auto">
                              <div className="h-full flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddSlide(row.id)
                                }}
                              >
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                  <Plus className="h-6 w-6" />
                                  <span className="text-xs font-medium">Add Slide</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </DndContext>
                    </div>
                  </TooltipProvider>
                )
              }
            }

            // Fallback for non-content mode
            return (
              <div className="text-sm text-muted-foreground">
                {getSlidesArray(row.slides).length} slides
              </div>
            )
          } else if (columnId === 'metrics') {
            // Show slide count for drafts
            return (
              <div className="text-sm text-muted-foreground">
                {getSlidesArray(row.slides).length} slides
              </div>
            )
          } else if (columnId === 'description') {
            // Show draft description - matching post column structure
            return (
              <div className="flex-shrink-0 w-52 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2">
                  <Badge variant="outline" className="text-xs">
                    Draft
                  </Badge>
                </div>
                <div className="overflow-y-auto h-48">
                  <InlineEditableText
                    value={row.description || ''}
                    onSave={async (newValue) => {
                      await handleSaveDraftDescription(row.id, newValue)
                    }}
                    placeholder="No description"
                    fixedHeight={true}
                    heightClass="h-full"
                    disabled={false}
                    className="text-[12px]"
                    rows={8}
                    searchTerms={searchTerms}
                  />
                </div>
              </div>
            )
          } else if (columnId === 'publishedAt') {
            // Show created date for drafts
            return (
              <div className="text-sm text-muted-foreground">
                {formatDate(row.createdAt)}
              </div>
            )
          } else if (columnId === 'actions') {
            // Action buttons for drafts - matching post column structure (vertical icon-only buttons)
            if (viewMode === 'content') {
              const draft = row as RemixPost
              const isBookmarked = draft.bookmarked || false

              return (
                <TooltipProvider>
                  <div className="flex flex-col gap-2">
                    {/* Bookmark Toggle Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleBookmark(row.id, isBookmarked)
                          }}
                          className={cn(
                            "h-8 w-8 p-0",
                            isBookmarked && "text-yellow-500 hover:text-yellow-600"
                          )}
                        >
                          <Star className={cn("h-4 w-4", isBookmarked && "fill-current")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>{isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Copy Draft Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyDraftToClipboard(row as RemixPost)
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Copy to Clipboard</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Edit Draft Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`/remix/${row.id}/edit`, '_blank')
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Edit Draft</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Settings Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSettingsClick(draft)
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Draft Settings</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Download Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadDraft(draft)
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Download ZIP</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Delete Draft Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(row.id, 'draft', row.name)
                          }}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Delete Draft</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )
            }

            // Fallback for non-content mode
            return null
          }

          // For other columns, return empty/null for drafts
          return <div className="text-xs text-muted-foreground">—</div>
        }

        // For post rows, add custom handlers for description and content saving
        if (columnId === 'description' && viewMode === 'content') {
          const post = row as TikTokPost
          const description = post.description || ''

          return (
            <div className="flex-shrink-0 w-52 flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2">
                <InlineCategorySelector
                  postId={post.id}
                  currentCategory={post.postCategory}
                  onUpdate={onRefetchData}
                />
              </div>
              <div className="overflow-y-auto h-48">
                <InlineEditableText
                  value={description || ''}
                  onSave={async (newValue) => {
                    await handleSavePostDescription(post.id, newValue)
                  }}
                  placeholder="No description"
                  fixedHeight={true}
                  heightClass="h-full"
                  disabled={false}
                  className="text-[12px]"
                  rows={8}
                  searchTerms={searchTerms}
                />
              </div>
            </div>
          )
        }

        // For post rows, use original cell renderer with added delete button
        if (columnId === 'actions' && viewMode === 'content') {
          const originalCell = col.cell(info)
          const post = row as TikTokPost

          // Wrap the original actions with our delete button
          return (
            <TooltipProvider>
              <div className="flex flex-col gap-2">
                {/* Original post action buttons */}
                {originalCell}

                {/* Delete Post Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(post.id, 'post', post.authorNickname || post.authorHandle || 'Post')
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Remove from Project</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )
        }

        return col.cell(info)
      }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePreviewPost, handleOpenImageGallery, handleRemixPost, handleRowClick, handleTriggerOCR, onRefetchData, viewMode, searchTerms, formatDate, handleDeleteClick, handleCopyDraftToClipboard, handleSavePostDescription, handleSaveDraftDescription, handleSaveDraftName, handleSaveDraftSlideText, getSlidesArray, handleAddSlide, handleRemoveSlide, handleReorderSlides, handleToggleBookmark, handleSetSlideBackground])
  // Note: Intentionally excluding selectedRows, handleSelectRow, handleSelectAll, allPostsSelected
  // The checkbox cells read current selection state when they render, but columns don't need to recreate

  // Update column visibility whenever columns, hiddenColumns, or viewMode changes
  useEffect(() => {
    const visibility: Record<string, boolean> = {}

    // Apply base hidden columns
    if (hiddenColumns) {
      hiddenColumns.forEach(colId => {
        visibility[colId] = false
      })
    }

    // Apply view mode visibility rules
    columns.forEach((col: any) => {
      const columnId = col.id || col.accessorKey
      if (!columnId) return

      if (viewMode === 'metrics' && col.meta?.hideInMetricsMode) {
        visibility[columnId] = false
      } else if (viewMode === 'content' && col.meta?.hideInContentMode) {
        visibility[columnId] = false
      }
    })

    setColumnVisibility(visibility)
  }, [hiddenColumns, columns, viewMode])

  // Global filter function to search across author and OCR text
  const globalFilterFn = (row: ProjectTableRow, filterValue: string) => {
    const searchLower = filterValue.toLowerCase()

    if (row._rowType === 'post') {
      // Search in author handle
      if (row.authorHandle?.toLowerCase().includes(searchLower)) return true

      // Search in author nickname
      if (row.authorNickname?.toLowerCase().includes(searchLower)) return true

      // Search in description
      if (row.description?.toLowerCase().includes(searchLower)) return true

      // Search in OCR texts
      if (row.images && Array.isArray(row.images)) {
        // Note: OCR text would need to be part of the post data from API
        // This is a placeholder for when OCR text is available
      }
    } else if (row._rowType === 'draft') {
      // Search in draft name
      if (row.name?.toLowerCase().includes(searchLower)) return true

      // Search in draft description
      if (row.description?.toLowerCase().includes(searchLower)) return true

      // Search in slide text
      if (row.slides && Array.isArray(row.slides)) {
        for (const slide of row.slides) {
          if (slide.paraphrasedText?.toLowerCase().includes(searchLower)) return true
        }
      }
    }

    return false
  }

  return (
    <>
      <div className="h-full flex flex-col min-h-0 min-w-0">
        <DataTable
          columns={columns}
          data={memoizedRowsWithProxiedUrls as any}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          enableSelection={true}
          onRowSelectionChange={onRowSelectionChange}
          enableSorting={true}
          enablePagination={false}
          leftStickyColumnsCount={3}
          rightStickyColumnsCount={1}
          fullWidth={true}
          isLoading={isLoading}
          rowClassName={rowClassName as any}
        />
      </div>

      {/* Post Preview Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post Preview</DialogTitle>
            <DialogDescription>
              @{selectedPost?.authorHandle} • {selectedPost ? formatDate(selectedPost.publishedAt) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4">
              {selectedPost.contentType === 'video' && selectedPost.videoUrl ? (
                <div className="flex justify-center">
                  <video
                    src={selectedPost.videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="max-w-full h-auto rounded-lg max-h-[60vh]"
                    poster={selectedPost.coverUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : selectedPost.coverId && (
                <div className="flex justify-center">
                  <img
                    src={getStableProxyUrl(selectedPost.coverId)}
                    alt="Post cover"
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm">{selectedPost.description || 'No description'}</p>
              </div>

              {selectedPost.hashtags.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Hashtags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedPost.hashtags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag.text}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Views:</span> {formatNumber(selectedPost.viewCount)}
                </div>
                <div>
                  <span className="font-semibold">Likes:</span> {formatNumber(selectedPost.likeCount)}
                </div>
                <div>
                  <span className="font-semibold">Comments:</span> {formatNumber(selectedPost.commentCount)}
                </div>
                <div>
                  <span className="font-semibold">Shares:</span> {formatNumber(selectedPost.shareCount)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Image Gallery Dialog */}
      <ImageGallery
        images={galleryImages}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        initialIndex={galleryInitialIndex}
      />

      {/* Post Analytics Sheet */}
      <PostAnalyticsSheet
        post={analyticsPost}
        open={showAnalytics}
        onOpenChange={setShowAnalytics}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDelete?.type === 'draft' ? 'Delete Draft?' : 'Remove Post from Project?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'draft' ? (
                <>
                  Are you sure you want to delete the draft "<strong>{itemToDelete.name}</strong>"?
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to remove "<strong>{itemToDelete?.name}</strong>" from this project?
                  This will only remove the reference, not delete the post itself.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {itemToDelete?.type === 'draft' ? 'Delete' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Draft Settings Dialog */}
      {selectedDraftForSettings && (
        <DraftSettingsDialog
          open={settingsDialogOpen}
          onClose={() => {
            setSettingsDialogOpen(false)
            setSelectedDraftForSettings(null)
          }}
          draftId={selectedDraftForSettings.id}
          currentCanvasSize={selectedDraftForSettings.canvasSize}
          onSave={() => {
            // Refresh the page to reload draft data
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
