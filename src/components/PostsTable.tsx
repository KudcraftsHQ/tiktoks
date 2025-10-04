'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
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
import { getProxiedImageUrl } from '@/lib/image-proxy'
import { useRouter } from 'next/navigation'

interface PostsTableProps {
  posts: TikTokPost[]
  loadMore?: () => void
  isFetching?: boolean
  hasMore?: boolean
  contentTypeFilter?: {
    value: 'all' | 'video' | 'photo'
    onChange: (value: 'all' | 'video' | 'photo') => void
  }
}

export function PostsTable({ posts, loadMore, isFetching, hasMore, contentTypeFilter }: PostsTableProps) {
  const router = useRouter()
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [selectedPost, setSelectedPost] = useState<TikTokPost | null>(null)
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


  const handlePreviewPost = (post: TikTokPost) => {
    setSelectedPost(post)
  }

  const handleOpenImageGallery = (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => {
    setGalleryImages(images)
    setGalleryInitialIndex(initialIndex)
    setShowGallery(true)
  }

  const handleRemixPost = (post: TikTokPost) => {
    router.push(`/posts/${post.id}/remix`)
  }

  // Infinite scroll detection - find the actual scrollable container
  const fetchMoreOnBottomReached = useCallback(() => {
    if (loadMore && hasMore && !isFetching) {
      // Find the scrollable parent (PageLayout's overflow-auto div)
      let scrollContainer = tableContainerRef.current?.parentElement
      while (scrollContainer) {
        const { overflow, overflowY } = window.getComputedStyle(scrollContainer)
        if (overflow === 'auto' || overflowY === 'auto' || overflow === 'scroll' || overflowY === 'scroll') {
          break
        }
        scrollContainer = scrollContainer.parentElement
      }

      if (scrollContainer) {
        const { scrollHeight, scrollTop, clientHeight } = scrollContainer
        // Fetch more when user scrolls within 500px of bottom
        if (scrollHeight - scrollTop - clientHeight < 500) {
          loadMore()
        }
      }
    }
  }, [loadMore, isFetching, hasMore])

  // Attach scroll listener to the actual scrollable container
  useEffect(() => {
    if (!loadMore) return

    // Find the scrollable parent
    let scrollContainer = tableContainerRef.current?.parentElement
    while (scrollContainer) {
      const { overflow, overflowY } = window.getComputedStyle(scrollContainer)
      if (overflow === 'auto' || overflowY === 'auto' || overflow === 'scroll' || overflowY === 'scroll') {
        break
      }
      scrollContainer = scrollContainer.parentElement
    }

    if (!scrollContainer) return

    const handleScroll = () => fetchMoreOnBottomReached()

    scrollContainer.addEventListener('scroll', handleScroll)
    // Check immediately on mount
    fetchMoreOnBottomReached()

    return () => scrollContainer?.removeEventListener('scroll', handleScroll)
  }, [fetchMoreOnBottomReached, loadMore])

  // Create columns with handlers
  const columns = useMemo(() => createPostsTableColumns({
    onPreviewPost: handlePreviewPost,
    onOpenImageGallery: handleOpenImageGallery,
    onRemixPost: handleRemixPost
  }), [])

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
      <div ref={tableContainerRef} className="h-full flex flex-col min-h-0">
        <DataTable
          columns={columns}
          data={posts}
          globalFilterFn={globalFilterFn}
          searchPlaceholder="Search by author, description..."
          showPagination={false}
          contentTypeFilter={contentTypeFilter}
        />
        {isFetching && (
          <div className="text-center py-4 text-muted-foreground border-t bg-background">
            Loading more posts...
          </div>
        )}
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
              {selectedPost.coverUrl && (
                <div className="flex justify-center">
                  <img
                    src={getProxiedImageUrl(selectedPost.coverUrl)}
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
    </>
  )
}