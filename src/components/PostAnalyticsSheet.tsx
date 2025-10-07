'use client'

import { useState, useEffect } from 'react'
import { TikTokPost } from '@/components/posts-table-columns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/SmartImage'
import { getProxiedImageUrl } from '@/lib/image-proxy'
import {
  Eye,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  ExternalLink,
  Calendar,
  TrendingUp,
  Video,
  Images,
  Music,
  Loader2,
  Sparkles
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PostAnalyticsSheetProps {
  post: TikTokPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
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

interface AnalyticsData {
  views: number[]
  likes: number[]
  shares: number[]
  comments: number[]
  saves: number[]
  dates: string[]
}

interface MetricsResponse {
  metrics: AnalyticsData
  current: {
    viewCount: number
    likeCount: number
    shareCount: number
    commentCount: number
    saveCount: number
  }
}

// Helper function to fill timeline from posting date to current date
function fillTimelineFromPostingDate(
  postingDate: string,
  metricsHistory: Array<{ viewCount: number; likeCount: number; shareCount: number; commentCount: number; saveCount: number; recordedAt: string }> | undefined,
  currentMetrics: { viewCount: number; likeCount: number; shareCount: number; commentCount: number; saveCount: number }
): AnalyticsData {
  const startDate = new Date(postingDate)
  const now = new Date()

  // Create a map of existing data points by date
  const dataMap = new Map<string, any>()

  if (metricsHistory && metricsHistory.length > 0) {
    metricsHistory.forEach(metric => {
      const dateKey = new Date(metric.recordedAt).toISOString().split('T')[0]
      dataMap.set(dateKey, metric)
    })
  }

  // Fill in all dates from posting to today
  const dates: string[] = []
  const views: number[] = []
  const likes: number[] = []
  const shares: number[] = []
  const comments: number[] = []
  const saves: number[] = []

  let currentDate = new Date(startDate)
  let lastKnownMetrics = { views: 0, likes: 0, shares: 0, comments: 0, saves: 0 }

  while (currentDate <= now) {
    const dateKey = currentDate.toISOString().split('T')[0]
    dates.push(currentDate.toISOString())

    const metric = dataMap.get(dateKey)
    if (metric) {
      // We have data for this date
      lastKnownMetrics = {
        views: Number(metric.viewCount || 0),
        likes: metric.likeCount || 0,
        shares: metric.shareCount || 0,
        comments: metric.commentCount || 0,
        saves: metric.saveCount || 0
      }
    }

    views.push(lastKnownMetrics.views)
    likes.push(lastKnownMetrics.likes)
    shares.push(lastKnownMetrics.shares)
    comments.push(lastKnownMetrics.comments)
    saves.push(lastKnownMetrics.saves)

    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Make sure the last point has current metrics
  if (views.length > 0) {
    views[views.length - 1] = currentMetrics.viewCount
    likes[likes.length - 1] = currentMetrics.likeCount
    shares[shares.length - 1] = currentMetrics.shareCount
    comments[comments.length - 1] = currentMetrics.commentCount
    saves[saves.length - 1] = currentMetrics.saveCount
  }

  return { views, likes, shares, comments, saves, dates }
}

interface MetricChartProps {
  title: string
  icon: React.ReactNode
  currentValue: number
  data: number[]
  color: string
}

function MetricChart({ title, icon, currentValue, data, color }: MetricChartProps) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const width = 300
  const height = 100

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${height} ${points} ${width},${height}`

  const growth = data.length >= 2 ? ((data[data.length - 1] - data[0]) / (data[0] || 1)) * 100 : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            {icon}
          </div>
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-600">
            {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="text-3xl font-bold">{formatNumber(currentValue)}</div>

      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full"
        >
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <polygon
            fill={`url(#gradient-${title})`}
            points={areaPoints}
          />

          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{data.length > 0 ? `${data.length} days` : 'Start'}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

export function PostAnalyticsSheet({ post, open, onOpenChange }: PostAnalyticsSheetProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch analytics data when sheet opens and post changes
  useEffect(() => {
    if (!post || !open) {
      setAnalyticsData(null)
      setError(null)
      return
    }

    // Use the timeline filling function with posting date
    const currentMetrics = {
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      shareCount: post.shareCount,
      commentCount: post.commentCount,
      saveCount: post.saveCount
    }

    // Fill timeline from posting date to now
    const timelineData = fillTimelineFromPostingDate(
      post.publishedAt,
      post.metricsHistory,
      currentMetrics
    )

    setAnalyticsData(timelineData)
    setLoading(false)
  }, [post, open])

  if (!post) return null

  const proxiedPost = post as any

  // Parse hashtags if needed
  const hashtags = Array.isArray(post.hashtags)
    ? post.hashtags
    : typeof post.hashtags === 'string'
      ? JSON.parse(post.hashtags || '[]')
      : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto p-6">

        <div className="space-y-6 py-6">
          {/* Post Preview */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              {/* Author Info */}
              <div className="flex items-center gap-3">
                {proxiedPost._proxiedAuthorAvatar ? (
                  <SmartImage
                    src={proxiedPost._proxiedAuthorAvatar}
                    alt={post.authorHandle || 'Author'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-semibold">{post.authorHandle?.[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{post.authorNickname || post.authorHandle}</p>
                  <p className="text-sm text-muted-foreground">@{post.authorHandle}</p>
                </div>
              </div>

              {/* Content Preview */}
              {post.contentType === 'photo' && proxiedPost._proxiedImages && proxiedPost._proxiedImages.length > 0 ? (
                <div className="grid grid-cols-5 gap-2">
                  {proxiedPost._proxiedImages.slice(0, 5).map((image: any, index: number) => (
                    <SmartImage
                      key={index}
                      src={image._proxiedUrl}
                      alt={`Photo ${index + 1}`}
                      className="w-full aspect-[9/16] rounded object-cover"
                    />
                  ))}
                  {proxiedPost._proxiedImages.length > 5 && (
                    <div className="w-full aspect-[9/16] rounded bg-muted flex items-center justify-center">
                      <span className="text-xs font-medium">+{proxiedPost._proxiedImages.length - 5}</span>
                    </div>
                  )}
                </div>
              ) : proxiedPost._proxiedCoverUrl ? (
                <SmartImage
                  src={proxiedPost._proxiedCoverUrl}
                  alt="Cover"
                  className="w-full aspect-video rounded object-cover"
                />
              ) : null}

              {/* Description */}
              {post.description && (
                <p className="text-sm">{post.description}</p>
              )}

              {/* Hashtags */}
              {hashtags && hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {hashtags.map((tag: any, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag.text}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Post Metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1">
                  {post.contentType === 'video' ? (
                    <>
                      <Video className="w-3 h-3" />
                      <span>Video {post.duration ? `• ${formatDuration(post.duration)}` : ''}</span>
                    </>
                  ) : (
                    <>
                      <Images className="w-3 h-3" />
                      <span>Photo Carousel</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(post.publishedAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(post.tiktokUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open on TikTok
              </Button>
              {post.contentType === 'photo' && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    router.push(`/posts/${post.id}/remix`)
                    onOpenChange(false)
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Remix
                </Button>
              )}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold">Performance Trends</h3>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading analytics...</span>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            ) : analyticsData ? (
              <>
                <div className="rounded-lg border border-border bg-card p-4">
                  <MetricChart
                    title="Views"
                    icon={<Eye className="w-4 h-4 text-blue-600" />}
                    currentValue={post.viewCount}
                    data={analyticsData.views}
                    color="rgb(37, 99, 235)"
                  />
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <MetricChart
                    title="Likes"
                    icon={<Heart className="w-4 h-4 text-red-600" />}
                    currentValue={post.likeCount}
                    data={analyticsData.likes}
                    color="rgb(220, 38, 38)"
                  />
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <MetricChart
                    title="Comments"
                    icon={<MessageCircle className="w-4 h-4 text-blue-600" />}
                    currentValue={post.commentCount}
                    data={analyticsData.comments}
                    color="rgb(59, 130, 246)"
                  />
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <MetricChart
                    title="Shares"
                    icon={<Share className="w-4 h-4 text-green-600" />}
                    currentValue={post.shareCount}
                    data={analyticsData.shares}
                    color="rgb(22, 163, 74)"
                  />
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <MetricChart
                    title="Saves"
                    icon={<Bookmark className="w-4 h-4 text-yellow-600" />}
                    currentValue={post.saveCount}
                    data={analyticsData.saves}
                    color="rgb(202, 138, 4)"
                  />
                </div>
              </>
            ) : null}
          </div>

          {/* Engagement Rate */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Engagement Rate</h3>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Like Rate</p>
                  <p className="text-2xl font-bold">
                    {((post.likeCount / post.viewCount) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comment Rate</p>
                  <p className="text-2xl font-bold">
                    {((post.commentCount / post.viewCount) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Share Rate</p>
                  <p className="text-2xl font-bold">
                    {((post.shareCount / post.viewCount) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Save Rate</p>
                  <p className="text-2xl font-bold">
                    {((post.saveCount / post.viewCount) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
