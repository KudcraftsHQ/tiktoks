'use client'

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  ArrowUp,
  ArrowDown,
  Images,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  MoreHorizontal
} from 'lucide-react'
import { createSortableHeader } from '@/components/ui/data-table'
import { getProxiedImageUrl } from '@/lib/image-proxy'
import { SmartImage } from '@/components/SmartImage'
import { MiniSparkline } from '@/components/MiniSparkline'
import { SlideClassificationBadge, SlideType } from '@/components/SlideClassificationBadge'
import { SlideTypeDropdown } from '@/components/SlideTypeDropdown'
import { InlineEditableText } from '@/components/InlineEditableText'
import { useRouter } from 'next/navigation'

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
  updatedAt: string
  metricsHistory?: Array<{
    viewCount: number
    likeCount: number
    shareCount: number
    commentCount: number
    saveCount: number
    recordedAt: string
  }>
  // OCR fields
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed'
  ocrProcessedAt?: string | null
  ocrTexts?: any
  // Classification fields
  slideClassifications?: any
  classificationStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  classificationProcessedAt?: string | null
  // Post category
  postCategory?: {
    id: string
    name: string
  } | null
}

interface PostsTableColumnsProps {
  onPreviewPost: (post: TikTokPost) => void
  onOpenImageGallery?: (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => void
  onRemixPost?: (post: TikTokPost) => void
  onRowClick?: (post: TikTokPost) => void
  onTriggerOCR?: (postId: string) => Promise<void>
  onRefetchPosts?: () => void
  selectedPosts?: Set<string>
  onSelectPost?: (postId: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  allSelected?: boolean
  viewMode?: 'metrics' | 'content'
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

const formatDateTime = (dateString: string): { date: string; time: string } => {
  const date = new Date(dateString)

  // Use user's locale for date formatting (will show in their local timezone)
  const dateStr = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)

  const timeStr = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)

  return { date: dateStr, time: timeStr }
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
  onRowClick,
  onTriggerOCR,
  onRefetchPosts,
  selectedPosts = new Set(),
  onSelectPost,
  onSelectAll,
  allSelected = false,
  viewMode = 'metrics'
}: PostsTableColumnsProps): ColumnDef<TikTokPost>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <div
        className="flex items-center justify-center w-full h-full"
        onClick={(e) => {
          e.stopPropagation()
          onSelectAll?.(!allSelected)
        }}
      >
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => {
            onSelectAll?.(checked === true)
          }}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => {
      const post = row.original
      // In content mode, show checkbox for all posts; in metrics mode, only photo posts
      if (viewMode === 'metrics' && post.contentType !== 'photo') {
        return null
      }
      return (
        <div
          className="flex items-center justify-center w-full h-full cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onSelectPost?.(post.id, !selectedPosts.has(post.id))
          }}
        >
          <Checkbox
            checked={selectedPosts.has(post.id)}
            onCheckedChange={(checked) => {
              onSelectPost?.(post.id, checked === true)
            }}
            aria-label={`Select ${post.authorHandle}`}
          />
        </div>
      )
    },
    size: 50,
    meta: { pinned: 'left' }
  },
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

      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (post.authorHandle) {
          window.location.href = `/profiles/${post.authorHandle}`
        }
      }

      return (
        <div
          className="flex items-center space-x-3 min-w-[180px] cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
          onClick={handleClick}
        >
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
    accessorKey: 'description',
    header: createSortableHeader('Description'),
    meta: {
      hideInMetricsMode: true
    },
    cell: ({ row }) => {
      const post = row.original
      const description = post.description || ''

      return (
        <div className="min-w-[250px] max-w-[300px]">
          {post.postCategory && (
            <div className="mb-2">
              <Badge variant="secondary" className="text-xs">
                {post.postCategory.name}
              </Badge>
            </div>
          )}
          <div className="h-48 overflow-y-auto">
            <InlineEditableText
              value={description || ''}
              onSave={async () => {}} // No-op save
              placeholder="No description"
              fixedHeight={true}
              heightClass="h-48"
              disabled={false}
              className="text-[12px]"
              rows={8}
            />
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
      const maxDisplay = viewMode === 'content' ? images.length : 5
      const displayImages = images.slice(0, maxDisplay)
      const remainingCount = images.length - maxDisplay

      // Parse OCR texts for content mode
      let ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }> = []
      if (viewMode === 'content') {
        try {
          if (post.ocrTexts) {
            const parsed = typeof post.ocrTexts === 'string'
              ? JSON.parse(post.ocrTexts)
              : post.ocrTexts
            ocrTexts = Array.isArray(parsed) ? parsed : []
          }
        } catch {
          ocrTexts = []
        }
      }

      // Parse slide classifications
      let slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }> = []
      if (viewMode === 'content') {
        try {
          if (post.slideClassifications) {
            const parsed = typeof post.slideClassifications === 'string'
              ? JSON.parse(post.slideClassifications)
              : post.slideClassifications
            slideClassifications = Array.isArray(parsed) ? parsed : []
          }
        } catch {
          slideClassifications = []
        }
      }

      // Content mode: Show horizontal slides with OCR text only (no images)
      if (viewMode === 'content' && post.contentType === 'photo' && images.length > 0) {
        return (
          <div className="w-full">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {displayImages.map((image: any, index: number) => {
                const ocrResult = ocrTexts.find(ocr => ocr.imageIndex === index)
                const ocrText = ocrResult?.success ? ocrResult.text : 'No text'
                const classification = slideClassifications.find(c => c.slideIndex === index)

                return (
                  <div key={index} className="flex-shrink-0 w-52 flex flex-col">
                    {/* Slide number badge */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded">
                        Slide {index + 1}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <SlideTypeDropdown
                          postId={post.id}
                          slideIndex={index}
                          currentType={classification?.slideType as 'hook' | 'content' | 'cta' | null}
                          onUpdate={onRefetchPosts}
                        />
                      </div>
                    </div>
                    {/* OCR text - fixed height with scroll */}
                    <div className="h-48 overflow-y-auto">
                      <InlineEditableText
                        value={ocrText}
                        onSave={async () => {}} // No-op save
                        placeholder={ocrResult?.success ? 'No text' : 'No text'}
                        fixedHeight={true}
                        heightClass="h-48"
                        disabled={false}
                        className="text-[12px]"
                        rows={8}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      // Metrics mode: Show compact thumbnails
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
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Eye className="w-4 h-4" />
            {isSorted === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
            {isSorted === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
            {!isSorted && <ArrowUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50" />}
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true
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
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Heart className={`w-4 h-4 ${isSorted ? 'text-red-600' : 'text-red-400'}`} />
            {isSorted === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
            {isSorted === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
            {!isSorted && <ArrowUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50" />}
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true
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
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <MessageCircle className={`w-4 h-4 ${isSorted ? 'text-blue-600' : 'text-blue-400'}`} />
            {isSorted === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
            {isSorted === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
            {!isSorted && <ArrowUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50" />}
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true
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
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Share className={`w-4 h-4 ${isSorted ? 'text-green-600' : 'text-green-400'}`} />
            {isSorted === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
            {isSorted === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
            {!isSorted && <ArrowUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50" />}
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true
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
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Bookmark className={`w-4 h-4 ${isSorted ? 'text-yellow-600' : 'text-yellow-400'}`} />
            {isSorted === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
            {isSorted === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
            {!isSorted && <ArrowUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50" />}
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true
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
    meta: {
      hideInContentMode: true
    },
    cell: ({ row }) => {
      const publishedAt = row.getValue('publishedAt') as string
      const { date, time } = formatDateTime(publishedAt)
      return (
        <div className="text-sm whitespace-nowrap">
          <div>{date}</div>
          <div className="text-muted-foreground text-xs">{time}</div>
        </div>
      )
    }
  },
  {
    accessorKey: 'updatedAt',
    header: createSortableHeader('Last Updated'),
    meta: {
      hideInContentMode: true
    },
    cell: ({ row }) => {
      const updatedAt = row.getValue('updatedAt') as string
      const { date, time } = formatDateTime(updatedAt)
      return (
        <div className="text-sm whitespace-nowrap">
          <div>{date}</div>
          <div className="text-muted-foreground text-xs">{time}</div>
        </div>
      )
    }
  },
  {
    accessorKey: 'ocrStatus',
    header: 'OCR Status',
    meta: {
      hideInContentMode: true
    },
    cell: ({ row }) => {
      const post = row.original
      
      // Only show OCR status for photo posts
      if (post.contentType !== 'photo') {
        return <div className="text-center text-muted-foreground text-xs">N/A</div>
      }

      const statusConfig = {
        pending: {
          icon: FileText,
          label: 'Pending',
          className: 'text-muted-foreground',
          bgClassName: 'bg-muted'
        },
        processing: {
          icon: Loader2,
          label: 'Processing',
          className: 'text-blue-600',
          bgClassName: 'bg-blue-50 dark:bg-blue-950'
        },
        completed: {
          icon: CheckCircle2,
          label: 'Completed',
          className: 'text-green-600',
          bgClassName: 'bg-green-50 dark:bg-green-950'
        },
        failed: {
          icon: XCircle,
          label: 'Failed',
          className: 'text-red-600',
          bgClassName: 'bg-red-50 dark:bg-red-950'
        }
      }

      const config = statusConfig[post.ocrStatus] || statusConfig.pending
      const Icon = config.icon

      return (
        <div className="flex items-center justify-center">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgClassName}`}>
            <Icon className={`w-3.5 h-3.5 ${config.className} ${post.ocrStatus === 'processing' ? 'animate-spin' : ''}`} />
            <span className={`text-xs font-medium ${config.className}`}>
              {config.label}
            </span>
          </div>
        </div>
      )
    }
  },
  {
    accessorKey: 'slideClassifications',
    header: 'Classifications',
    meta: {
      hideInContentMode: true
    },
    cell: ({ row }) => {
      const post = row.original

      // Only show classifications for photo posts
      if (post.contentType !== 'photo') {
        return <div className="text-center text-muted-foreground text-xs">N/A</div>
      }

      // Parse classifications
      let classifications: Array<{
        slideIndex: number
        type: SlideType
        categoryId: string
        categoryName: string
        confidence?: number
      }> = []

      try {
        if (post.slideClassifications) {
          const parsed = typeof post.slideClassifications === 'string'
            ? JSON.parse(post.slideClassifications)
            : post.slideClassifications
          classifications = Array.isArray(parsed) ? parsed : []
        }
      } catch {
        classifications = []
      }

      // Show status if no classifications yet
      if (classifications.length === 0) {
        const status = post.classificationStatus || 'pending'

        if (status === 'pending' || status === 'processing') {
          return (
            <div className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-muted">
              {status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">
                {status === 'processing' ? 'Classifying...' : 'Not classified'}
              </span>
            </div>
          )
        }

        if (status === 'failed') {
          return (
            <div className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950">
              <XCircle className="w-3 h-3 text-red-600" />
              <span className="text-xs text-red-600">Failed</span>
            </div>
          )
        }

        return <div className="text-center text-muted-foreground text-xs">-</div>
      }

      // Count classifications by type
      const counts = classifications.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
      }, {} as Record<SlideType, number>)

      return (
        <div className="flex flex-wrap gap-1 items-center justify-center max-w-[200px]">
          {(['HOOK', 'CONTENT', 'CTA'] as SlideType[]).map(type => {
            const count = counts[type]
            if (!count) return null

            return (
              <div key={type} className="flex items-center gap-0.5">
                <SlideClassificationBadge type={type} />
                <span className="text-xs text-muted-foreground">×{count}</span>
              </div>
            )
          })}
        </div>
      )
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    size: 80,
    meta: {
      pinned: 'right'
    },
    cell: ({ row }) => {
      const post = row.original

      const handleTriggerOCR = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!onTriggerOCR) return

        try {
          await onTriggerOCR(post.id)
        } catch (err) {
          // Error handling is done in parent component
        }
      }

      return (
        <div className="flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {post.contentType === 'photo' && onTriggerOCR && (
                <DropdownMenuItem
                  onClick={handleTriggerOCR}
                  disabled={post.ocrStatus === 'processing'}
                >
                  {post.ocrStatus === 'processing' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {post.ocrStatus === 'completed' ? 'OCR Complete' : post.ocrStatus === 'processing' ? 'Processing OCR...' : post.ocrStatus === 'failed' ? 'Retry OCR' : 'Run OCR'}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(post.tiktokUrl, '_blank')
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open on TikTok
              </DropdownMenuItem>

              {post.contentType === 'photo' && onRemixPost && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemixPost(post)
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
                  Create Remix
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  }
]