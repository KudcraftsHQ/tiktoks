'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PostsTable } from '@/components/PostsTable'
import { PostTypeFilter } from '@/components/PostTypeFilter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Users,
  Heart,
  Video,
  CheckCircle,
  User,
  Activity,
  Play,
  Eye,
  ChevronLeft
} from 'lucide-react'
import { TikTokPost } from '@/components/posts-table-columns'
import { TikTokProfile } from '@/components/profiles-table-columns'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { designTokens } from '@/lib/design-tokens'
import { PageLayout } from '@/components/PageLayout'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'
import { SortingState } from '@tanstack/react-table'

interface ProfilePostsResult {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
  page: number
  limit: number
  error?: string
}

export default function ProfileDetailPage() {
  const params = useParams()
  const handle = params.handle as string

  const [profile, setProfile] = useState<TikTokProfile | null>(null)
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'video' | 'photo'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  const [monitoringEnabled, setMonitoringEnabled] = useState(false)
  const [monitoringLoading, setMonitoringLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [firstPostDate, setFirstPostDate] = useState<string | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)


  const fetchProfile = useCallback(async () => {
    if (!handle) return

    setProfileLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/by-handle/${handle}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile')
      }

      setProfile(result)
      setMonitoringEnabled(result.monitoringEnabled || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile')
    } finally {
      setProfileLoading(false)
    }
  }, [handle])

  const fetchProfilePosts = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      })

      if (contentTypeFilter !== 'all') {
        params.append('contentType', contentTypeFilter)
      }

      // Add sorting parameters
      if (sorting.length > 0) {
        const sort = sorting[0]
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }

      const response = await fetch(`/api/tiktok/profiles/${profile.id}/posts?${params.toString()}`)
      const result: ProfilePostsResult = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profile posts')
      }

      setPosts(result.posts)
      setTotalPosts(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [profile?.id, currentPage, contentTypeFilter, sorting])

  const fetchActivityData = useCallback(async () => {
    if (!profile?.id) return

    setActivityLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profile.id}/activity`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error('Failed to fetch activity data')
      }

      setActivityData(result.data || [])
      setFirstPostDate(result.firstPostDate || null)
    } catch (err) {
      console.error('Failed to fetch activity data:', err)
      setActivityData([])
      setFirstPostDate(null)
    } finally {
      setActivityLoading(false)
    }
  }, [profile?.id])

  const handleRefresh = useCallback(() => {
    fetchProfile()
    fetchProfilePosts()
    fetchActivityData()
  }, [fetchProfile, fetchProfilePosts, fetchActivityData])

  const handleMonitoringToggle = useCallback(async (enabled: boolean) => {
    if (!profile?.id) return

    setMonitoringLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profile.id}/monitoring`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      })

      if (!response.ok) {
        throw new Error('Failed to update monitoring status')
      }

      const result = await response.json()
      setMonitoringEnabled(result.profile.monitoringEnabled)

      toast.success(enabled ? 'Monitoring enabled' : 'Monitoring disabled', {
        description: enabled ? 'Profile will be monitored every 24 hours' : 'Automatic monitoring stopped'
      })

      // Refresh profile to get updated monitoring info
      fetchProfile()
    } catch (err) {
      console.error('Failed to toggle monitoring:', err)
      toast.error('Failed to update monitoring status')
      // Revert the switch on error
      setMonitoringEnabled(!enabled)
    } finally {
      setMonitoringLoading(false)
    }
  }, [profile?.id, fetchProfile])

  const handleManualTrigger = useCallback(async () => {
    if (!profile?.id) return

    setTriggerLoading(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profile.id}/monitoring/trigger`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to trigger monitoring')
      }

      const result = await response.json()

      toast.success('Monitoring queued', {
        description: 'Profile update has been queued and will be processed shortly'
      })
    } catch (err) {
      console.error('Failed to trigger monitoring:', err)
      toast.error('Failed to queue monitoring', {
        description: 'Please try again later'
      })
    } finally {
      setTriggerLoading(false)
    }
  }, [profile?.id])

  // Load profile and posts on mount and when filters change
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    fetchProfilePosts()
  }, [fetchProfilePosts])

  useEffect(() => {
    fetchActivityData()
  }, [fetchActivityData])

  const formatNumber = (num?: number | null): string => {
    if (!num) return '0'
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
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

  const filteredPosts = useMemo(() =>
    posts.filter(post => {
      if (contentTypeFilter === 'all') return true
      return post.contentType === contentTypeFilter
    }), [posts, contentTypeFilter]
  )

  if (profileLoading) {
    return (
      <PageLayout
        title={
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          </div>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          </div>
        }
      >
        <div className="h-full grid grid-rows-[auto_1fr] min-h-0 gap-4">
          {/* Profile Metrics and Activity Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
            {/* Metrics Grid Skeleton - 2x3 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>

            {/* Heatmap Skeleton */}
            <div className="h-full rounded-lg border border-border bg-card">
              <div className="p-4 pb-3">
                <div className="h-6 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="p-4 pt-0">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-24 w-full bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Posts Table Skeleton */}
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading profile...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    )
  }

  if (!profile) {
    return (
      <div className={`${designTokens.container.full} ${designTokens.spacing.page.responsive}`}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className={`${designTokens.spacing.cardContent.responsive} py-6`}>
            <p className="text-red-600">{error || 'Profile not found'}</p>
            <Link href="/profiles">
              <Button className="mt-4 w-full sm:w-auto" variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profiles
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <Link href="/profiles">
            <Button variant="secondary" size="icon" className="rounded-full">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={`${profile.handle} avatar`}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <span>@{profile.handle}</span>
          {profile.verified && (
            <CheckCircle className="w-5 h-5 text-blue-500" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="monitoring-switch" className="text-sm cursor-pointer">
              Monitor
            </Label>
            <Switch
              id="monitoring-switch"
              checked={monitoringEnabled}
              onCheckedChange={handleMonitoringToggle}
              disabled={monitoringLoading}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualTrigger}
            disabled={triggerLoading}
          >
            <Play className={`w-4 h-4 mr-2 ${triggerLoading ? 'animate-spin' : ''}`} />
            Update Now
          </Button>
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="h-full grid grid-rows-[auto_1fr] min-h-0 gap-4">
        {/* Profile Metrics and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
          {/* Metrics Grid - 2x3 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">Posts</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(profile.totalPosts)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Views</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalViews?.toString() || '0'))}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">Likes</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalLikes?.toString() || '0'))}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Shares</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalShares?.toString() || '0'))}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">Comments</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalComments?.toString() || '0'))}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-pink-500" />
                </div>
                <span className="text-sm text-muted-foreground">Followers</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(profile.followerCount)}</div>
            </div>
          </div>

          {/* Posting Activity Heatmap */}
          {activityLoading ? (
            <div className="h-full rounded-lg border border-border bg-card">
              <div className="p-4 pb-3">
                <div className="h-6 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="p-4 pt-0">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-24 w-full bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
          ) : (
            <PostingActivityHeatmap data={activityData} firstPostDate={firstPostDate} />
          )}
        </div>

        {/* Posts Table - Takes remaining height, filter is inside */}
        {posts.length > 0 ? (
          <div className="min-h-0">
            <PostsTable
              posts={filteredPosts}
              contentTypeFilter={{
                value: contentTypeFilter,
                onChange: setContentTypeFilter
              }}
              onSortingChange={setSorting}
              sorting={sorting}
              enableServerSideSorting={true}
              hiddenColumns={['authorHandle']}
            />
          </div>
        ) : loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading posts...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No posts found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                No posts have been saved for this profile yet. Use the Profile Explorer to fetch and save posts from @{profile.handle}.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}
