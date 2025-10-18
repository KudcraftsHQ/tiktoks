'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
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
import { SmartImage } from '@/components/SmartImage'
import { PostAnalyticsSheet } from '@/components/PostAnalyticsSheet'
import { SortingState } from '@tanstack/react-table'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DateRange } from '@/components/DateRangeFilter'

interface PostsTableProps {
  posts: TikTokPost[]
  totalPosts?: number
  contentTypeFilter?: {
    value: 'all' | 'video' | 'photo'
    onChange: (value: 'all' | 'video' | 'photo') => void
  }
  dateRangeFilter?: {
    value: DateRange
    onChange: (range: DateRange) => void
  }
  onPageChange?: (pageIndex: number, pageSize: number) => void
  onSortingChange?: (sorting: SortingState) => void
  sorting?: SortingState
  isLoading?: boolean
  hiddenColumns?: string[]
  enableServerSideSorting?: boolean
  // Selection state (controlled from parent)
  selectedPosts?: Set<string>
  onSelectionChange?: (selectedPosts: Set<string>) => void
}

export function PostsTable({
  posts,
  totalPosts,
  contentTypeFilter,
  dateRangeFilter,
  onPageChange,
  onSortingChange,
  sorting,
  isLoading,
  hiddenColumns,
  enableServerSideSorting = false,
  selectedPosts: externalSelectedPosts,
  onSelectionChange
}: PostsTableProps) {
  const [selectedPost, setSelectedPost] = useState<TikTokPost | null>(null)
  const [analyticsPost, setAnalyticsPost] = useState<TikTokPost | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  // Use external selection state if provided, otherwise use internal state
  const [internalSelectedPosts, setInternalSelectedPosts] = useState<Set<string>>(new Set())
  const selectedPosts = externalSelectedPosts ?? internalSelectedPosts
  const setSelectedPosts = onSelectionChange ?? setInternalSelectedPosts
  const [isBulkOCRing, setIsBulkOCRing] = useState(false)

  const photoPosts = posts.filter(p => p.contentType === 'photo')
  const allPhotosSelected = photoPosts.length > 0 && selectedPosts.size === photoPosts.length

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

  const handleRowClick = useCallback((post: TikTokPost) => {
    setAnalyticsPost(post)
    setShowAnalytics(true)
  }, [])

  const handleTriggerOCR = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/tiktok/posts/${postId}/ocr`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to trigger OCR')
      }

      toast.success('OCR processing started')
    } catch (err) {
      console.error('Failed to trigger OCR:', err)
      toast.error('Failed to start OCR processing')
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
      // Only select photo posts
      const photoPosts = postsWithProxiedUrls.filter(p => p.contentType === 'photo')
      const newSet = new Set(photoPosts.map(p => p.id))
      setSelectedPosts(newSet)
    } else {
      setSelectedPosts(new Set())
    }
  }, [postsWithProxiedUrls, setSelectedPosts])

  const handleBulkOCR = async () => {
    if (selectedPosts.size === 0) return

    setIsBulkOCRing(true)
    try {
      const response = await fetch('/api/tiktok/posts/bulk-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postIds: Array.from(selectedPosts)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to bulk OCR')
      }

      await response.json()

      toast.success(`OCR started for ${selectedPosts.size} posts`)

      // Clear selection
      setSelectedPosts(new Set())
    } catch (err) {
      console.error('Failed to bulk OCR:', err)
      toast.error('Failed to start bulk OCR processing')
    } finally {
      setIsBulkOCRing(false)
    }
  }

  // Create columns - memoized with all necessary dependencies
  // Selection state IS included but handlers are memoized to minimize re-creation
  const columns = useMemo(() => {
    return createPostsTableColumns({
      onPreviewPost: handlePreviewPost,
      onOpenImageGallery: handleOpenImageGallery,
      onRemixPost: handleRemixPost,
      onRowClick: handleRowClick,
      onTriggerOCR: handleTriggerOCR,
      selectedPosts,
      onSelectPost: handleSelectPost,
      onSelectAll: handleSelectAll,
      allSelected: allPhotosSelected
    })
  }, [handlePreviewPost, handleOpenImageGallery, handleRemixPost, handleRowClick, handleTriggerOCR, selectedPosts, handleSelectPost, handleSelectAll, allPhotosSelected])

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
      <div className="h-full flex flex-col min-h-0">
        <DataTable
          columns={columns}
          data={postsWithProxiedUrls}
          getRowId={(post) => post.id}
          globalFilterFn={globalFilterFn}
          searchPlaceholder="Search by author, description..."
          showPagination={true}
          contentTypeFilter={contentTypeFilter}
          dateRangeFilter={dateRangeFilter}
          onPageChange={onPageChange}
          onSortingChange={onSortingChange}
          sorting={sorting}
          manualSorting={enableServerSideSorting}
          manualPagination={true}
          totalRows={totalPosts}
          isLoading={isLoading}
          enableColumnPinning={true}
          hiddenColumns={hiddenColumns}
          onRowClick={handleRowClick}
          customHeaderActions={
            selectedPosts.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedPosts.size} selected
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkOCR}
                  disabled={isBulkOCRing}
                >
                  {isBulkOCRing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-1" />
                      Run OCR on Selected
                    </>
                  )}
                </Button>
              </div>
            ) : null
          }
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
                  <SmartImage
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