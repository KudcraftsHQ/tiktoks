'use client'

import { useState, useMemo } from 'react'
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
}

export function PostsTable({ posts }: PostsTableProps) {
  const router = useRouter()
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

  // Create columns with handlers
  const columns = useMemo(() => createPostsTableColumns({
    onPreviewPost: handlePreviewPost,
    onOpenImageGallery: handleOpenImageGallery,
    onRemixPost: handleRemixPost
  }), [])

  return (
    <>
      <DataTable
        columns={columns}
        data={posts}
        searchKey="title"
        searchPlaceholder="Search posts..."
        showPagination={false}
      />

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