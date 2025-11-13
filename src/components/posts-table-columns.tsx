'use client'

import React, { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ExternalLink, Heart,
  MessageCircle,
  Share,
  Bookmark,
  Eye, Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  MoreHorizontal,
  Copy
} from 'lucide-react'
import { SmartImage } from '@/components/SmartImage'
import { MiniSparkline } from '@/components/MiniSparkline'
import { SlideClassificationBadge, SlideType } from '@/components/SlideClassificationBadge'
import { SlideTypeDropdown } from '@/components/SlideTypeDropdown'
import { InlineEditableText } from '@/components/InlineEditableText'
import { HighlightedText } from '@/components/HighlightedText'
import { InlineCategorySelector } from '@/components/InlineCategorySelector'

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
  searchTerms?: string[]
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
// Actions cell component to properly handle hooks
const ActionsCell = ({
  post,
  viewMode,
  onTriggerOCR,
  onRemixPost
}: {
  post: TikTokPost
  viewMode?: 'metrics' | 'content'
  onTriggerOCR?: (postId: string) => Promise<void>
  onRemixPost?: (post: TikTokPost) => void
}) => {
  const [isCopying, setIsCopying] = useState(false)

  const handleTriggerOCR = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onTriggerOCR) return

    try {
      await onTriggerOCR(post.id)
    } catch (err) {
      // Error handling is done in parent component
    }
  }

  const handleCopyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCopying(true)

    try {
      const sections: string[] = []

      // Post counter as H1
      sections.push(`# Post`)
      sections.push('')

      // Description as H2
      if (post.description) {
        sections.push('## Description')
        sections.push('')
        sections.push(post.description)
        sections.push('')
      }

      // Parse OCR texts
      let ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }> = []
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

      // Parse slide classifications
      let slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }> = []
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

      // Content text with slides as H2
      if (post.images && post.images.length > 0) {
        sections.push('## Content Text')
        sections.push('')

        post.images.forEach((img, slideIndex) => {
          // Get OCR text by imageIndex
          const ocrResult = ocrTexts.find(ocr => ocr.imageIndex === slideIndex)
          const ocrText = ocrResult?.success ? ocrResult.text : null

          // Get slide type from classifications
          const classification = slideClassifications.find(c => c.slideIndex === slideIndex)
          const slideType = classification?.slideType || 'unknown'

          if (ocrText) {
            sections.push(`### Slide ${slideIndex + 1} - ${slideType}`)
            sections.push('')
            sections.push(ocrText)
            sections.push('')
          }
        })
      }

      const markdownContent = sections.join('\n')

      // Copy to clipboard
      await navigator.clipboard.writeText(markdownContent)

      // Show success toast
      toast.success('Copied to clipboard', {
        description: 'Post data is ready to paste'
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard', {
        description: 'Please try again'
      })
    } finally {
      setIsCopying(false)
    }
  }

  // Content mode: Show vertical action buttons with icons only
  if (viewMode === 'content') {
    const ocrTooltipText = post.ocrStatus === 'completed'
      ? 'OCR Complete'
      : post.ocrStatus === 'processing'
      ? 'Processing...'
      : post.ocrStatus === 'failed'
      ? 'Retry OCR'
      : 'Run OCR'

    return (
      <TooltipProvider>
        <div className="flex flex-col gap-2">
          {/* Copy to Clipboard Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyToClipboard}
                disabled={isCopying}
                className="h-8 w-8 p-0"
              >
                {isCopying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Copy to Clipboard</p>
            </TooltipContent>
          </Tooltip>

          {/* OCR Button - only for photo posts */}
          {post.contentType === 'photo' && onTriggerOCR && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTriggerOCR}
                  disabled={post.ocrStatus === 'processing'}
                  className="h-8 w-8 p-0"
                >
                  {post.ocrStatus === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{ocrTooltipText}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Open on TikTok Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(post.tiktokUrl, '_blank')
                }}
                className="h-8 w-8 p-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Open on TikTok</p>
            </TooltipContent>
          </Tooltip>

          {/* Create Remix Button - only for photo posts */}
          {post.contentType === 'photo' && onRemixPost && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemixPost(post)
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Create Remix</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    )
  }

  // Metrics mode: Show dropdown menu
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
  viewMode = 'metrics',
  searchTerms = []
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
    minSize: 50,
    maxSize: 50,
    meta: { pinned: 'left' }
  },
  {
    accessorKey: 'authorHandle',
    header: 'Author',
    enableSorting: true,
    size: viewMode === 'content' ? 250 : 180,
    minSize: viewMode === 'content' ? 250 : 180,
    maxSize: viewMode === 'content' ? 250 : 180,
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

      // Content mode: show author info + slides content
      if (viewMode === 'content') {
        const images = post._proxiedImages || []

        // Parse slide classifications
        let slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }> = []
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

        return (
          <div className="flex flex-col items-start gap-3 w-full ">
            {/* Row 1: Author Info */}
            <div
              className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
              onClick={handleClick}
            >
              {post._proxiedAuthorAvatar ? (
                <SmartImage
                  src={post._proxiedAuthorAvatar}
                  alt={post.authorHandle}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  fallback={
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
                    </div>
                  }
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  <HighlightedText
                    text={post.authorNickname || post.authorHandle || ''}
                    searchTerms={searchTerms}
                  />
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @<HighlightedText
                    text={post.authorHandle || ''}
                    searchTerms={searchTerms}
                  />
                </p>
              </div>
            </div>

            {/* Row 2: Slides Content (compact thumbnails like metrics mode) */}
            {post.contentType === 'photo' && images.length > 0 && (
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  {images.slice(0, 5).map((image: any, index: number) => {
                    const isLast = index === images.slice(0, 5).length - 1
                    const remainingCount = images.length - 5

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
                        {isLast && remainingCount > 0 && (
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
              </div>
            )}
          </div>
        )
      }

      // Metrics mode: original layout
      return (
        <div
          className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
          onClick={handleClick}
        >
          {post._proxiedAuthorAvatar ? (
            <SmartImage
              src={post._proxiedAuthorAvatar}
              alt={post.authorHandle}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              fallback={
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
                </div>
              }
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              <HighlightedText
                text={post.authorNickname || post.authorHandle || ''}
                searchTerms={searchTerms}
              />
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @<HighlightedText
                text={post.authorHandle || ''}
                searchTerms={searchTerms}
              />
            </p>
          </div>
        </div>
      )
    }
  },
  {
    id: 'metrics',
    header: 'Metrics',
    size: 100,
    meta: {
      hideInMetricsMode: true
    },
    cell: ({ row }) => {
      const post = row.original

      return (
        <div className="flex flex-col gap-2">
          {/* Views */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-sm font-mono">{formatNumber(post.viewCount)}</span>
          </div>

          {/* Likes */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <Heart className="w-3.5 h-3.5 text-red-500" />
            </div>
            <span className="text-sm font-mono">{formatNumber(post.likeCount)}</span>
          </div>

          {/* Comments */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-sm font-mono">{formatNumber(post.commentCount)}</span>
          </div>

          {/* Shares */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Share className="w-3.5 h-3.5 text-green-500" />
            </div>
            <span className="text-sm font-mono">{formatNumber(post.shareCount)}</span>
          </div>

          {/* Saves */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
              <Bookmark className="w-3.5 h-3.5 text-yellow-500" />
            </div>
            <span className="text-sm font-mono">{formatNumber(post.saveCount)}</span>
          </div>
        </div>
      )
    }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    meta: {
      hideInMetricsMode: true
    },
    enableSorting: false,
    size: 224,
    cell: ({ row }) => {
      const post = row.original
      const description = post.description || ''

      return (
        <div className="flex-shrink-0 w-52 flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2">
            <InlineCategorySelector
              postId={post.id}
              currentCategory={post.postCategory}
              onUpdate={onRefetchPosts}
            />
          </div>
          <div className="overflow-y-auto h-48">
            <InlineEditableText
              value={description || ''}
              onSave={async () => {}} // No-op save
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
  },
  {
    accessorKey: 'title',
    header: 'Content',
    minSize: viewMode === 'content' ? 1720 : 248,
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
                        searchTerms={searchTerms}
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
    },
  },
  {
    accessorKey: 'viewCount',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return (
        <div className="flex items-center justify-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true,
      align: 'center'
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
        <div className="flex items-center justify-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Heart className={`w-4 h-4 ${isSorted ? 'text-red-600' : 'text-red-400'}`} />
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true,
      align: 'center'
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
        <div className="flex items-center justify-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <MessageCircle className={`w-4 h-4 ${isSorted ? 'text-blue-600' : 'text-blue-400'}`} />
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true,
      align: 'center'
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
        <div className="flex items-center justify-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Share className={`w-4 h-4 ${isSorted ? 'text-green-600' : 'text-green-400'}`} />
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true,
      align: 'center'
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
        <div className="flex items-center justify-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={`h-auto p-1 hover:bg-transparent group ${isSorted ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            <Bookmark className={`w-4 h-4 ${isSorted ? 'text-yellow-600' : 'text-yellow-400'}`} />
          </Button>
        </div>
      )
    },
    meta: {
      hideInContentMode: true,
      align: 'center'
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
    header: 'Published',
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
    header: 'Last Updated',
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
    id: 'actions',
    header: '',
    size: viewMode === 'content' ? 50 : 36,
    meta: {
      pinned: 'right'
    },
    cell: ({ row }) => (
      <ActionsCell
        post={row.original}
        viewMode={viewMode}
        onTriggerOCR={onTriggerOCR}
        onRemixPost={onRemixPost}
      />
    )
  }
]