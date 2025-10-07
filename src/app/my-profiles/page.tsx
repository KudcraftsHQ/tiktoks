'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProfilesTable } from '@/components/ProfilesTable'
import { RefreshCw, Users, Star, Eye, Heart, Video, MessageCircle, Share2, Bookmark } from 'lucide-react'
import Link from 'next/link'
import { PageLayout } from '@/components/PageLayout'
import { TikTokProfile } from '@/components/profiles-table-columns'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'

export default function MyProfilesPage() {
  const [profiles, setProfiles] = useState<TikTokProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [firstPostDate, setFirstPostDate] = useState<string | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)

  const fetchOwnProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tiktok/profiles?isOwnProfile=true')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profiles')
      }

      setProfiles(result.profiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAggregatedActivity = useCallback(async () => {
    if (profiles.length === 0) return

    setActivityLoading(true)
    try {
      // Fetch activity data for all profiles
      const activityPromises = profiles.map(profile =>
        fetch(`/api/tiktok/profiles/${profile.id}/activity`)
          .then(res => res.json())
          .catch(() => ({ data: [], firstPostDate: null }))
      )

      const results = await Promise.all(activityPromises)

      // Aggregate activity data by date
      const aggregatedMap = new Map<string, number>()
      let earliestDate: string | null = null

      results.forEach(result => {
        if (result.data && Array.isArray(result.data)) {
          result.data.forEach((item: { date: string; count: number }) => {
            const currentCount = aggregatedMap.get(item.date) || 0
            aggregatedMap.set(item.date, currentCount + item.count)
          })
        }

        // Track earliest post date
        if (result.firstPostDate) {
          if (!earliestDate || result.firstPostDate < earliestDate) {
            earliestDate = result.firstPostDate
          }
        }
      })

      // Convert map to array
      const aggregatedData = Array.from(aggregatedMap.entries()).map(([date, count]) => ({
        date,
        count
      }))

      setActivityData(aggregatedData)
      setFirstPostDate(earliestDate)
    } catch (err) {
      console.error('Failed to fetch aggregated activity data:', err)
      setActivityData([])
      setFirstPostDate(null)
    } finally {
      setActivityLoading(false)
    }
  }, [profiles])

  const handleRefresh = useCallback(() => {
    fetchOwnProfiles()
    fetchAggregatedActivity()
  }, [fetchOwnProfiles, fetchAggregatedActivity])

  useEffect(() => {
    fetchOwnProfiles()
  }, [fetchOwnProfiles])

  useEffect(() => {
    fetchAggregatedActivity()
  }, [fetchAggregatedActivity])

  const formatNumber = (num: string | number): string => {
    const value = typeof num === 'string' ? parseInt(num) : num
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  // Calculate aggregated stats
  const totalStats = profiles.reduce((acc, profile) => ({
    posts: acc.posts + profile.totalPosts,
    views: acc.views + Number(profile.totalViews || 0),
    likes: acc.likes + Number(profile.totalLikes || 0),
    shares: acc.shares + Number(profile.totalShares || 0),
    comments: acc.comments + Number(profile.totalComments || 0),
    saves: acc.saves + Number(profile.totalSaves || 0),
  }), { posts: 0, views: 0, likes: 0, shares: 0, comments: 0, saves: 0 })

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          <span>My Profiles</span>
        </div>
      }
      description={`Manage your TikTok profiles (${profiles.length} profile${profiles.length !== 1 ? 's' : ''})`}
      headerActions={
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/profiles">
            <Button variant="default" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Browse All Profiles
            </Button>
          </Link>
        </div>
      }
    >
      {/* Profile Metrics and Activity */}
      {profiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 mb-6">
          {/* Metrics Grid - 2x3 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">Posts</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.posts)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Views</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.views)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">Likes</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.likes)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Shares</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.shares)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">Comments</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.comments)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Bookmark className="w-4 h-4 text-yellow-500" />
                </div>
                <span className="text-sm text-muted-foreground">Saves</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(totalStats.saves)}</div>
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
      )}

      {/* Profiles Table */}
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : profiles.length > 0 ? (
        <ProfilesTable profiles={profiles} onProfilesChange={handleRefresh} />
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading your profiles...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No profiles marked as yours</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You haven't marked any TikTok profiles as your own yet. Browse all profiles and mark the ones you manage.
            </p>
            <Link href="/profiles">
              <Button variant="default">
                <Users className="w-4 h-4 mr-2" />
                Browse All Profiles
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  )
}
