'use client'

import React, { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  Eye,
  FolderPlus,
  Loader2,
  Copy,
  ScanLine,
  Clock,
  CheckIcon,
  XIcon,
  Lightbulb
} from 'lucide-react'
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
  musicTitle?: string // Music title (e.g., "original sound - username")
  musicAuthor?: string // Music author/artist name
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
  onCreateProject?: (post: TikTokPost) => void
  onRowClick?: (post: TikTokPost) => void
  onTriggerOCR?: (postId: string) => Promise<void>
  onExtractConcepts?: (postId: string) => Promise<void>
  onRefetchPosts?: () => void
  selectedPosts?: Set<string>
  onSelectPost?: (postId: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  allSelected?: boolean
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

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 4) return `${diffWeek}w ago`
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return `${diffYear}y ago`
}

// OCR Status Button Component
interface OCRStatusButtonProps {
  post: TikTokPost
  onTriggerOCR?: (postId: string) => Promise<void>
  compact?: boolean
}

function OCRStatusButton({ post, onTriggerOCR, compact = false }: OCRStatusButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onTriggerOCR || isProcessing) return

    setIsProcessing(true)
    try {
      await onTriggerOCR(post.id)
    } catch (err) {
      // Error handling is done in parent component
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusConfig = () => {
    if (isProcessing || post.ocrStatus === 'processing') {
      return {
        icon: ScanLine,
        statusIcon: Loader2,
        label: 'Processing',
        tooltip: 'OCR is being processed...',
        iconClass: 'text-blue-600',
        statusIconClass: 'text-blue-600 animate-spin',
        bgClass: 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50',
        disabled: true
      }
    }

    if (post.ocrStatus === 'completed') {
      return {
        icon: ScanLine,
        statusIcon: CheckIcon,
        label: 'Re-scan',
        tooltip: 'OCR completed. Click to re-scan or reset',
        iconClass: 'text-green-600',
        statusIconClass: 'text-green-600',
        bgClass: 'bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50',
        disabled: false
      }
    }

    if (post.ocrStatus === 'failed') {
      return {
        icon: ScanLine,
        statusIcon: XIcon,
        label: 'Retry',
        tooltip: 'OCR failed. Click to retry',
        iconClass: 'text-red-600',
        statusIconClass: 'text-red-600',
        bgClass: 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
        disabled: false
      }
    }

    // pending
    return {
      icon: ScanLine,
      statusIcon: Clock,
      label: 'Scan',
      tooltip: 'Click to start OCR scanning',
      iconClass: 'text-muted-foreground',
      statusIconClass: 'text-muted-foreground',
      bgClass: 'bg-muted hover:bg-muted/80',
      disabled: false
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon
  const StatusIcon = config.statusIcon

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            disabled={config.disabled}
            className="h-8 w-8 p-0"
          >
            <div className="relative inline-flex">
              <Icon className={`h-4 w-4 ${config.iconClass}`} />
              {StatusIcon && (
                <span className="absolute -right-0.5 -bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-background">
                  <StatusIcon className={`h-1.5 w-1.5 ${config.statusIconClass}`} />
                </span>
              )}
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={config.disabled}
          className={`h-8 px-3 gap-2 ${config.bgClass} transition-colors`}
        >
          <div className="relative inline-flex">
            <Icon className={`h-4 w-4 ${config.iconClass}`} />
            {StatusIcon && (
              <span className="absolute -right-0.5 -bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-background">
                <StatusIcon className={`h-1.5 w-1.5 ${config.statusIconClass}`} />
              </span>
            )}
          </div>
          {!compact && <span className="text-xs font-medium">{config.label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}
// Actions cell component to properly handle hooks
const ActionsCell = ({
  post,
  onTriggerOCR,
  onCreateProject,
  onExtractConcepts
}: {
  post: TikTokPost
  onTriggerOCR?: (postId: string) => Promise<void>
  onCreateProject?: (post: TikTokPost) => void
  onExtractConcepts?: (postId: string) => Promise<void>
}) => {
  const [isCopying, setIsCopying] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)

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
          <OCRStatusButton
            post={post}
            onTriggerOCR={onTriggerOCR}
            compact={true}
          />
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

        {/* Create Project Button - only for photo posts */}
        {post.contentType === 'photo' && onCreateProject && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateProject(post)
                }}
                className="h-8 w-8 p-0"
              >
                <FolderPlus className="h-4 w-4 text-purple-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Create Project</p>
          </TooltipContent>
        </Tooltip>
        )}

        {/* Extract Concepts Button - only for photo posts with completed OCR */}
        {post.contentType === 'photo' && post.ocrStatus === 'completed' && onExtractConcepts && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation()
                  setIsExtracting(true)
                  try {
                    await onExtractConcepts(post.id)
                  } finally {
                    setIsExtracting(false)
                  }
                }}
                disabled={isExtracting}
                className="h-8 w-8 p-0"
              >
                {isExtracting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Extract Concepts</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

export const createPostsTableColumns = ({
  onPreviewPost,
  onOpenImageGallery,
  onCreateProject,
  onTriggerOCR,
  onExtractConcepts,
  onRefetchPosts,
  searchTerms = []
}: PostsTableColumnsProps): ColumnDef<TikTokPost>[] => [
  {
    accessorKey: 'authorHandle',
    header: 'Author',
    enableSorting: false,
    size: 250,
    minSize: 250,
    maxSize: 250,
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

      const { date, time } = formatDateTime(post.publishedAt)
      const relativeUpdated = formatRelativeTime(post.updatedAt)
      const images = post._proxiedImages || []

      return (
        <div className="flex flex-col items-start gap-3 w-full ">
          {/* Row 1: Author Info */}
          <div
            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
            onClick={handleClick}
          >
            {post._proxiedAuthorAvatar ? (
              <img
                src={post._proxiedAuthorAvatar}
                alt={post.authorHandle}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
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

          {/* Row 2: Slides Content (compact thumbnails) */}
          {post.contentType === 'photo' && images.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                {images.slice(0, 5).map((image: any, index: number) => {
                  const isLast = index === images.slice(0, 5).length - 1
                  const remainingCount = images.length - 5

                  return (
                    <div key={index} className="relative">
                      <img
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

          {/* Row 2.5: Music Info */}
          {post.musicTitle && post.musicAuthor && post.musicUrl && (
            <a
              href={post.musicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
              <span className="truncate">
                <span className="font-medium">{post.musicTitle}</span>
                {post.musicAuthor && <span className="ml-1">· {post.musicAuthor}</span>}
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </a>
          )}

          {/* Row 3: Published and Updated date */}
          <div className="text-xs flex flex-col gap-0.5">
            <div>
              <span>{date}</span>
              <span className="ml-1 text-muted-foreground">{time}</span>
            </div>
            <div className="text-muted-foreground">
              Updated {relativeUpdated}
            </div>
          </div>
        </div>
      )
    }
  },
  {
    id: 'metrics',
    header: 'Metrics',
    size: 100,
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
    enableSorting: false,
    minSize: 1720,
    cell: ({ row }) => {
      const post = row.original as any
      const images = post._proxiedImages || []

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

      // Show horizontal slides with OCR text
      if (post.contentType === 'photo' && images.length > 0) {
        const isOCRCompleted = post.ocrStatus === 'completed'

        return (
          <div className="w-full">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((image: any, index: number) => {
                const ocrResult = ocrTexts.find(ocr => ocr.imageIndex === index)
                const ocrText = ocrResult?.success ? ocrResult.text : ''
                const classification = slideClassifications.find(c => c.slideIndex === index)
                const hasOCRText = ocrResult?.success && ocrText.trim().length > 0

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
                        value={hasOCRText ? ocrText : ''}
                        onSave={async (newValue) => {
                          try {
                            const response = await fetch(`/api/tiktok/posts/${post.id}/ocr`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                slideIndex: index,
                                text: newValue
                              })
                            })

                            if (!response.ok) {
                              throw new Error('Failed to update slide text')
                            }

                            toast.success('Slide text updated')
                            if (onRefetchPosts) {
                              onRefetchPosts()
                            }
                          } catch (error) {
                            console.error('Failed to update slide text:', error)
                            toast.error('Failed to update slide text')
                            throw error
                          }
                        }}
                        placeholder={isOCRCompleted ? 'No text detected' : 'Run OCR to extract text'}
                        fixedHeight={true}
                        heightClass="h-48"
                        disabled={!isOCRCompleted}
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

      // Fallback for video posts or posts without images
      return null
    },
  },
  {
    id: 'actions',
    header: '',
    size: 50,
    meta: {
      pinned: 'right'
    },
    cell: ({ row }) => (
      <ActionsCell
        post={row.original}
        onTriggerOCR={onTriggerOCR}
        onCreateProject={onCreateProject}
        onExtractConcepts={onExtractConcepts}
      />
    )
  }
]