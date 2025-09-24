'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ExternalLink,
  Video,
  Image as ImageIcon,
  Play,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  Eye,
  Clock,
  ArrowUpDown,
  Images,
  Sparkles
} from 'lucide-react'
import { createSortableHeader } from '@/components/ui/data-table'
import { getProxiedImageUrl } from '@/lib/image-proxy'

export interface TikTokPost {
  id: string
  tiktokId: string
  tiktokUrl: string
  contentType: 'video' | 'photo'
  title?: string
  description?: string
  authorNickname?: string
  authorHandle?: string
  authorAvatar?: string // Resolved avatar URL from authorAvatarId via API
  authorAvatarId?: string // Cache asset ID (for reference, usually not used directly in UI)
  hashtags: Array<{ text: string; url: string }>
  mentions: string[]
  viewCount: number
  likeCount: number
  shareCount: number
  commentCount: number
  saveCount: number
  duration?: number
  videoUrl?: string // Resolved video URL from videoId via API
  videoId?: string // Cache asset ID (for reference, usually not used directly in UI)
  coverUrl?: string // Resolved cover URL from coverId via API
  coverId?: string // Cache asset ID (for reference, usually not used directly in UI)
  musicUrl?: string // Resolved music URL from musicId via API
  musicId?: string // Cache asset ID (for reference, usually not used directly in UI)
  images: Array<{
    url: string // Resolved image URL from cacheAssetId via API
    width: number
    height: number
    cacheAssetId?: string // Cache asset ID (for reference, usually not used directly in UI)
  }>
  publishedAt: string
}

interface PostsTableColumnsProps {
  onPreviewPost: (post: TikTokPost) => void
  onAddToCollection: (post: TikTokPost) => void
  onOpenImageGallery?: (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => void
  onRemixPost?: (post: TikTokPost) => void
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const formatDuration = (seconds?: number): string => {
  if (!seconds) return ''

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${remainingSeconds}s`
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}

const parseImages = (images: any): Array<{ url: string; width: number; height: number }> => {
  if (Array.isArray(images)) {
    return images
  }
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export const createPostsTableColumns = ({
  onPreviewPost,
  onAddToCollection,
  onOpenImageGallery,
  onRemixPost
}: PostsTableColumnsProps): ColumnDef<TikTokPost>[] => [
  {
    accessorKey: 'contentType',
    header: '',
    cell: ({ row }) => {
      const post = row.original
      return (
        <div className="flex items-center justify-center">
          {post.contentType === 'video' ? (
            <div className="flex flex-col items-center">
              <Video className="w-5 h-5 text-blue-600" />
              {post.duration && (
                <span className="text-xs text-muted-foreground mt-1">
                  {formatDuration(post.duration)}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Images className="w-5 h-5 text-green-600" />
            </div>
          )}
        </div>
      )
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const aType = rowA.original.contentType
      const bType = rowB.original.contentType
      if (aType === bType) return 0
      return aType === 'video' ? -1 : 1
    }
  },
  {
    accessorKey: 'title',
    header: createSortableHeader('Content'),
    cell: ({ row }) => {
      const post = row.original
      return (
        <div className="space-y-2 min-w-[200px]">
          <div className="flex items-center space-x-2">
            {post.contentType === 'photo' && parseImages(post.images).length > 0 ? (
              <div className="flex space-x-1">
                {parseImages(post.images).map((image, index) => (
                  <img
                    key={index}
                    src={getProxiedImageUrl(image.url)}
                    alt={`Photo ${index + 1}`}
                    className="w-10 aspect-[9/16] rounded object-cover cursor-pointer hover:opacity-80 border"
                    onClick={() => onOpenImageGallery?.(parseImages(post.images), index)}
                  />
                ))}
              </div>
            ) : post.coverUrl ? (
              <img
                src={getProxiedImageUrl(post.coverUrl)}
                alt="Cover"
                className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80"
                onClick={() => onPreviewPost(post)}
              />
            ) : null}
          </div>
        </div>
      )
    }
  },
  {
    accessorKey: 'viewCount',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent ${isSorted ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Eye className="w-4 h-4" />
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const viewCount = row.getValue('viewCount') as number
      return (
        <div className="text-center font-mono text-sm">
          {formatNumber(viewCount)}
        </div>
      )
    }
  },
  {
    accessorKey: 'likeCount',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent ${isSorted ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Heart className={`w-4 h-4 ${isSorted ? 'text-red-600' : 'text-red-400'}`} />
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const likeCount = row.getValue('likeCount') as number
      return (
        <div className="text-center font-mono text-sm">
          {formatNumber(likeCount)}
        </div>
      )
    }
  },
  {
    accessorKey: 'commentCount',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent ${isSorted ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <MessageCircle className={`w-4 h-4 ${isSorted ? 'text-blue-600' : 'text-blue-400'}`} />
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const commentCount = row.getValue('commentCount') as number
      return (
        <div className="text-center font-mono text-sm">
          {formatNumber(commentCount)}
        </div>
      )
    }
  },
  {
    accessorKey: 'shareCount',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent ${isSorted ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Share className={`w-4 h-4 ${isSorted ? 'text-green-600' : 'text-green-400'}`} />
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const shareCount = row.getValue('shareCount') as number
      return (
        <div className="text-center font-mono text-sm">
          {formatNumber(shareCount)}
        </div>
      )
    }
  },
  {
    accessorKey: 'saveCount',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent ${isSorted ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Bookmark className={`w-4 h-4 ${isSorted ? 'text-yellow-600' : 'text-yellow-400'}`} />
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const saveCount = row.getValue('saveCount') as number
      return (
        <div className="text-center font-mono text-sm">
          {formatNumber(saveCount)}
        </div>
      )
    }
  },
  {
    accessorKey: 'publishedAt',
    header: createSortableHeader('Published'),
    cell: ({ row }) => {
      const publishedAt = row.getValue('publishedAt') as string
      return (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(publishedAt)}
        </div>
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const post = row.original

      return (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(post.tiktokUrl, '_blank')}
            title="Open on TikTok"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>

          {post.contentType === 'photo' && onRemixPost && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemixPost(post)}
              title="Create Remix"
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Sparkles className="w-3 h-3" />
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={() => onAddToCollection(post)}
            title="Add to Collection"
          >
            <Bookmark className="w-3 h-3" />
          </Button>
        </div>
      )
    }
  }
]