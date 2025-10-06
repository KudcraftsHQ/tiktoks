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
  Eye
} from 'lucide-react'
import { TikTokPost } from '@/components/posts-table-columns'
import { TikTokProfile } from '@/components/profiles-table-columns'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { designTokens } from '@/lib/design-tokens'
import { PageLayout } from '@/components/PageLayout'

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
  }, [profile?.id, currentPage, contentTypeFilter])

  const handleRefresh = useCallback(() => {
    fetchProfile()
    fetchProfilePosts()
  }, [fetchProfile, fetchProfilePosts])

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
      <div className={`${designTokens.container.full} ${designTokens.spacing.page.responsive}`}>
        <Card>
          <CardContent className={`${designTokens.spacing.cardContent.responsive} flex items-center justify-center py-12`}>
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading profile...</span>
            </div>
          </CardContent>
        </Card>
      </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.tiktok.com/@${profile.handle}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            TikTok
          </Button>
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/profiles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      }
    >
      <div className="h-full grid grid-rows-[auto_1fr] min-h-0 gap-4">
        {/* Profile Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">Posts</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(profile.totalPosts)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Views</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalViews?.toString() || '0'))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">Likes</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalLikes?.toString() || '0'))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Shares</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalShares?.toString() || '0'))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">Comments</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(parseInt(profile.totalComments?.toString() || '0'))}</div>
            </CardContent>
          </Card>
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
