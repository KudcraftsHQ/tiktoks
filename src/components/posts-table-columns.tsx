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
import { SmartImage } from '@/components/SmartImage'
import { MiniSparkline } from '@/components/MiniSparkline'

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
  metricsHistory?: Array<{
    viewCount: number
    likeCount: number
    shareCount: number
    commentCount: number
    saveCount: number
    recordedAt: string
  }>
}

interface PostsTableColumnsProps {
  onPreviewPost: (post: TikTokPost) => void
  onOpenImageGallery?: (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => void
  onRemixPost?: (post: TikTokPost) => void
  onRowClick?: (post: TikTokPost) => void
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
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
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
  onOpenImageGallery,
  onRemixPost,
  onRowClick
}: PostsTableColumnsProps): ColumnDef<TikTokPost>[] => [
  {
    accessorKey: 'contentType',
    header: '',
    size: 50,
    meta: {
      pinned: 'left'
    },
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
    accessorKey: 'authorHandle',
    header: createSortableHeader('Author'),
    meta: {
      pinned: 'left'
    },
    cell: ({ row }) => {
      const post = row.original as any
      return (
        <div className="flex items-center space-x-3 min-w-[180px]">
          {post._proxiedAuthorAvatar ? (
            <SmartImage
              src={post._proxiedAuthorAvatar}
              alt={post.authorHandle}
              className="w-10 h-10 rounded-full object-cover"
              fallback={
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
                </div>
              }
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{post.authorNickname || post.authorHandle}</p>
            <p className="text-xs text-muted-foreground truncate">@{post.authorHandle}</p>
          </div>
        </div>
      )
    }
  },
  {
    accessorKey: 'title',
    header: createSortableHeader('Content'),
    cell: ({ row }) => {
      const post = row.original as any
      const images = post._proxiedImages || []
      const maxDisplay = 5
      const displayImages = images.slice(0, maxDisplay)
      const remainingCount = images.length - maxDisplay

      return (
        <div className="space-y-2 min-w-[200px]">
          <div className="flex items-center space-x-2">
            {post.contentType === 'photo' && images.length > 0 ? (
              <div className="flex space-x-1">
                {displayImages.map((image: any, index: number) => {
                  const isLast = index === displayImages.length - 1
                  const showOverlay = isLast && remainingCount > 0

                  return (
                    <div key={index} className="relative">
                      <SmartImage
                        src={image._proxiedUrl}
                        alt={`Photo ${index + 1}`}
                        className="w-10 aspect-[9/16] rounded object-cover cursor-pointer hover:opacity-80 border"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenImageGallery?.(images.map((img: any) => ({ url: img.url, width: img.width, height: img.height })), index)
                        }}
                      />
                      {showOverlay && (
                        <div
                          className="absolute inset-0 bg-black/70 rounded flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenImageGallery?.(images.map((img: any) => ({ url: img.url, width: img.width, height: img.height })), index)
                          }}
                        >
                          <span className="text-white text-xs font-bold">
                            +{remainingCount}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : post._proxiedCoverUrl ? (
              <SmartImage
                src={post._proxiedCoverUrl}
                alt="Cover"
                className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewPost(post)
                }}
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
      const post = row.original

      // Build timeline from posting date to now
      let viewHistory: number[] = []

      if (post.publishedAt) {
        const startDate = new Date(post.publishedAt)
        const now = new Date()
        const dataMap = new Map<string, number>()

        // Map existing metrics by date
        if (post.metricsHistory && post.metricsHistory.length > 0) {
          post.metricsHistory.forEach(h => {
            const dateKey = new Date(h.recordedAt).toISOString().split('T')[0]
            dataMap.set(dateKey, Number(h.viewCount || 0))
          })
        }

        // Fill timeline
        let currentDate = new Date(startDate)
        let lastValue = 0

        while (currentDate <= now) {
          const dateKey = currentDate.toISOString().split('T')[0]
          const value = dataMap.get(dateKey)
          if (value !== undefined) {
            lastValue = value
          }
          viewHistory.push(lastValue)
          currentDate.setDate(currentDate.getDate() + 1)
        }

        // Ensure last value is current
        if (viewHistory.length > 0) {
          viewHistory[viewHistory.length - 1] = viewCount
        }
      } else {
        // Fallback: simple line from 0 to current
        viewHistory = [0, viewCount]
      }

      return (
        <div className="flex items-center gap-2 justify-center">
          <div className="font-mono text-sm">
            {formatNumber(viewCount)}
          </div>
          <MiniSparkline
            data={viewHistory}
            width={60}
            height={20}
            color="rgb(37, 99, 235)"
          />
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
    size: 120,
    meta: {
      pinned: 'right'
    },
    cell: ({ row }) => {
      const post = row.original

      return (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              window.open(post.tiktokUrl, '_blank')
            }}
            title="Open on TikTok"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>

          {post.contentType === 'photo' && onRemixPost && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRemixPost(post)
              }}
              title="Create Remix"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
            </Button>
          )}
        </div>
      )
    }
  }
]