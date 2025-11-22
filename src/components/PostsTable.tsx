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
import { SortingState } from '@tanstack/react-table'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DateRange } from '@/components/DateRangeFilter'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface PostsTableProps {
  posts: TikTokPost[]
  totalPosts?: number
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
  onRefetchPosts?: () => void
  sorting?: SortingState
  isLoading?: boolean
  hiddenColumns?: string[]
  enableServerSideSorting?: boolean
  // Selection state (controlled from parent)
  selectedPosts?: Set<string>
  onSelectionChange?: (selectedPosts: Set<string>) => void
  searchQuery?: string
  rowClassName?: (row: any) => string
}

export function PostsTable({
  posts,
  totalPosts,
  categoryFilter,
  dateRangeFilter,
  onPageChange,
  onSortingChange,
  onRefetchPosts,
  sorting,
  isLoading,
  hiddenColumns,
  enableServerSideSorting = false,
  selectedPosts: externalSelectedPosts,
  onSelectionChange,
  rowClassName,
  searchQuery = ''
}: PostsTableProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [selectedPost, setSelectedPost] = useState<TikTokPost | null>(null)
  const [analyticsPost, setAnalyticsPost] = useState<TikTokPost | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  // Use external selection state if provided, otherwise use internal state
  const [internalSelectedPosts, setInternalSelectedPosts] = useState<Set<string>>(new Set())
  const selectedPosts = externalSelectedPosts ?? internalSelectedPosts
  const setSelectedPosts = onSelectionChange ?? setInternalSelectedPosts
  const [isBulkOCRing, setIsBulkOCRing] = useState(false)

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

  const photoPosts = posts.filter(p => p.contentType === 'photo')
  const allPhotosSelected = photoPosts.length > 0 && selectedPosts.size === photoPosts.length
  const allPostsSelected = posts.length > 0 && selectedPosts.size === posts.length

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

  // Memoize posts with stable proxy URLs using cache asset IDs
  const postsWithProxiedUrls = useMemo(() => {
    return posts.map(post => ({
      ...post,
      _proxiedAuthorAvatar: getStableProxyUrl(post.authorAvatarId),
      _proxiedCoverUrl: getStableProxyUrl(post.coverId),
      _proxiedImages: post.images?.map(img => ({
        ...img,
        _proxiedUrl: getStableProxyUrl(img.cacheAssetId)
      }))
    }))
  }, [posts])

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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    )
  }

  // Handle row selection changes from DataTable
  const handleRowSelectionChange = useCallback((rowSelectionState: Record<string, boolean>) => {
    // Convert row selection state (index-based) to Set of post IDs
    const selectedIds = new Set<string>()
    Object.keys(rowSelectionState).forEach(rowIndex => {
      if (rowSelectionState[rowIndex]) {
        const post = postsWithProxiedUrls[parseInt(rowIndex)]
        if (post) {
          selectedIds.add(post.id)
        }
      }
    })
    setSelectedPosts(selectedIds)
  }, [postsWithProxiedUrls, setSelectedPosts])

  // Memoize all handlers to prevent columns regeneration
  const handlePreviewPost = useCallback((post: TikTokPost) => {
    setSelectedPost(post)
  }, [])

  const handleOpenImageGallery = useCallback((images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => {
    setGalleryImages(images)
    setGalleryInitialIndex(initialIndex)
    setShowGallery(true)
  }, [])

  const [isCreatingProject, setIsCreatingProject] = useState(false)

  const handleCreateProject = useCallback(async (post: TikTokPost) => {
    setIsCreatingProject(true)
    try {
      const response = await fetch('/api/projects/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: [post.id] })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const data = await response.json()

      if (data.projects && data.projects.length > 0) {
        toast.success('Project created', {
          description: data.projects[0].name,
          action: {
            label: 'View Project',
            onClick: () => router.push(`/projects/${data.projects[0].id}`)
          }
        })
      }
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setIsCreatingProject(false)
    }
  }, [router])

  const handleRowClick = useCallback((post: TikTokPost) => {
    setAnalyticsPost(post)
    setShowAnalytics(true)
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

  const handleExtractConcepts = useCallback(async (postId: string) => {
    try {
      const response = await fetch('/api/concepts/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postIds: [postId] })
      })

      if (!response.ok) {
        throw new Error('Failed to extract concepts')
      }

      const data = await response.json()

      if (data.success) {
        toast.success(`Extracted ${data.conceptsCreated} new concepts`, {
          description: data.examplesAdded > 0
            ? `${data.examplesAdded} examples added to existing concepts`
            : undefined,
        })
      } else {
        throw new Error(data.error || 'Failed to extract concepts')
      }
    } catch (err) {
      console.error('Failed to extract concepts:', err)
      toast.error('Failed to extract concepts')
      throw err
    }
  }, [])

  const handleSelectPost = useCallback((postId: string, selected: boolean) => {
    const newSet = new Set(selectedPosts)
    if (selected) {
      newSet.add(postId)
    } else {
      newSet.delete(postId)
    }
    setSelectedPosts(newSet)
  }, [selectedPosts, setSelectedPosts])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      // Select all posts
      const newSet = new Set(postsWithProxiedUrls.map(p => p.id))
      setSelectedPosts(newSet)
    } else {
      setSelectedPosts(new Set())
    }
  }, [postsWithProxiedUrls, setSelectedPosts])

  const handleBulkOCR = async () => {
    if (selectedPosts.size === 0) return

    setIsBulkOCRing(true)
    try {
      const response = await fetch('/api/tiktok/posts/batch-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postIds: Array.from(selectedPosts)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process posts')
      }

      await response.json()

      toast.success(`OCR and classification started for ${selectedPosts.size} posts`)

      // Clear selection
      setSelectedPosts(new Set())
    } catch (err) {
      console.error('Failed to process posts:', err)
      toast.error('Failed to start OCR and classification processing')
    } finally {
      setIsBulkOCRing(false)
    }
  }

  const [isGeneratingRemix, setIsGeneratingRemix] = useState(false)

  const handleGenerateRemixFromSelected = async () => {
    if (selectedPosts.size === 0) return

    setIsGeneratingRemix(true)
    try {
      const response = await fetch('/api/remixes/generate-from-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postIds: Array.from(selectedPosts)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate remix')
      }

      const result = await response.json()

      toast.success('Remix generated successfully!')

      // Navigate to the remix edit page
      if (result.remixId) {
        window.open(`/remix/${result.remixId}/edit`, '_blank')
      }

      // Clear selection
      setSelectedPosts(new Set())
    } catch (err) {
      console.error('Failed to generate remix:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to generate remix')
    } finally {
      setIsGeneratingRemix(false)
    }
  }

  // Create columns - memoized with all necessary dependencies
  const columns = useMemo(() => {
    return createPostsTableColumns({
      onPreviewPost: handlePreviewPost,
      onOpenImageGallery: handleOpenImageGallery,
      onCreateProject: handleCreateProject,
      onTriggerOCR: handleTriggerOCR,
      onExtractConcepts: handleExtractConcepts,
      onRefetchPosts,
      searchTerms
    })
  }, [handlePreviewPost, handleOpenImageGallery, handleCreateProject, handleTriggerOCR, handleExtractConcepts, onRefetchPosts, searchTerms])

  // Update column visibility whenever hiddenColumns changes
  useEffect(() => {
    const visibility: Record<string, boolean> = {}

    // Apply base hidden columns
    if (hiddenColumns) {
      hiddenColumns.forEach(colId => {
        visibility[colId] = false
      })
    }

    setColumnVisibility(visibility)
  }, [hiddenColumns, columns])

  // Global filter function to search across author and OCR text
  const globalFilterFn = (post: TikTokPost, filterValue: string) => {
    const searchLower = filterValue.toLowerCase()

    // Search in author handle
    if (post.authorHandle?.toLowerCase().includes(searchLower)) return true

    // Search in author nickname
    if (post.authorNickname?.toLowerCase().includes(searchLower)) return true

    // Search in description
    if (post.description?.toLowerCase().includes(searchLower)) return true

    // Search in OCR texts
    if (post.images && Array.isArray(post.images)) {
      // Note: OCR text would need to be part of the post data from API
      // This is a placeholder for when OCR text is available
    }

    return false
  }

  return (
    <>
      <div className="h-full flex flex-col min-h-0 min-w-0">
        <DataTable
          columns={columns}
          data={postsWithProxiedUrls}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          enableSorting={true}
          enablePagination={true}
          enableSelection={true}
          onRowSelectionChange={handleRowSelectionChange}
          pageSize={10}
          leftStickyColumnsCount={3}
          rightStickyColumnsCount={1}
          fullWidth={true}
          isLoading={isLoading}
          rowClassName={rowClassName as any}
          sorting={sorting}
          onSortingChange={onSortingChange}
          manualSorting={enableServerSideSorting}
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
    </>
  )
}