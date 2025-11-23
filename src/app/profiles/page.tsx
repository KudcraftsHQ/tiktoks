'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { ProfilesTable } from '@/components/ProfilesTable'
import { Button } from '@/components/ui/button'
import { RefreshCw, Users, Video, Eye, Heart, MessageCircle, Bookmark, FolderPlus, Play } from 'lucide-react'
import { TikTokProfile } from '@/components/profiles-table-columns'
import { PageLayout } from '@/components/PageLayout'
import { AddProfileDialog } from '@/components/AddProfileDialog'
import { DateRange, DateRangeFilter } from '@/components/DateRangeFilter'
import { BulkGroupAssignDialog } from '@/components/BulkGroupAssignDialog'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'
import { DailyViewsChart, DailyViewsDataPoint } from '@/components/DailyViewsChart'
import { calculateProfileAggregateMetrics, compareMetrics } from '@/lib/profile-metrics-calculator'
import { startOfDay, endOfDay, subDays, parseISO } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProfilesResult {
  profiles: TikTokProfile[]
  hasMore: boolean
  total: number
  page: number
  limit: number
  error?: string
}

interface ProfileGroup {
  id: string
  name: string
  profileCount: number
}

function ProfilesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse URL params or use defaults
  const getInitialDateRange = (): DateRange => {
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    if (fromParam && toParam) {
      try {
        return {
          from: startOfDay(parseISO(fromParam)),
          to: endOfDay(parseISO(toParam))
        }
      } catch {
        // Fall through to default
      }
    }

    // Default to last 7 days
    return {
      from: startOfDay(subDays(new Date(), 7)),
      to: endOfDay(new Date())
    }
  }

  const getInitialGroup = (): string => {
    return searchParams.get('group') || 'all'
  }

  const [profiles, setProfiles] = useState<TikTokProfile[]>([])
  const [loading, setLoading] = useState(true) // Start as true for initial load
  const [hasLoaded, setHasLoaded] = useState(false) // Track if initial fetch completed
  const [error, setError] = useState<string | null>(null)
  const [totalProfiles, setTotalProfiles] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange)
  const [selectedGroup, setSelectedGroup] = useState<string>(getInitialGroup)
  const [groups, setGroups] = useState<ProfileGroup[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
  const [isBulkGroupDialogOpen, setIsBulkGroupDialogOpen] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [dailyViewsData, setDailyViewsData] = useState<DailyViewsDataPoint[]>([])

  // Update URL when filters change
  const updateUrlParams = useCallback((newDateRange: DateRange, newGroup: string) => {
    const params = new URLSearchParams()

    if (newDateRange.from) {
      params.set('from', newDateRange.from.toISOString().split('T')[0])
    }
    if (newDateRange.to) {
      params.set('to', newDateRange.to.toISOString().split('T')[0])
    }
    if (newGroup && newGroup !== 'all') {
      params.set('group', newGroup)
    }

    const queryString = params.toString()
    router.replace(queryString ? `?${queryString}` : '/profiles', { scroll: false })
  }, [router])

  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    return calculateProfileAggregateMetrics(profiles)
  }, [profiles])

  // Fetch groups for filter dropdown
  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/profile-groups')
      if (!response.ok) throw new Error('Failed to fetch groups')

      const data = await response.json()
      if (data.success) {
        setGroups(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    }
  }, [])

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: '100'
      })

      // Add group filter
      if (selectedGroup && selectedGroup !== 'all') {
        params.append('groupId', selectedGroup)
      }

      // Add date range filter
      if (dateRange.from) {
        params.append('dateFrom', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        params.append('dateTo', dateRange.to.toISOString())
      }

      const response = await fetch(`/api/tiktok/profiles?${params}`)
      const result: ProfilesResult = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch profiles')
      }

      setProfiles(result.profiles)
      setTotalProfiles(result.total)

      // Fetch posting activity and daily views data from API in parallel
      const [activity, dailyViews] = await Promise.all([
        fetchPostingActivityData(),
        fetchDailyViewsData()
      ])
      setActivityData(activity)
      setDailyViewsData(dailyViews)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setProfiles([])
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [selectedGroup, dateRange])

  // Fetch posting activity data from API
  const fetchPostingActivityData = async (): Promise<Array<{ date: string; count: number }>> => {
    try {
      const params = new URLSearchParams()

      if (dateRange.from) {
        params.append('dateFrom', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        params.append('dateTo', dateRange.to.toISOString())
      }
      if (selectedGroup && selectedGroup !== 'all') {
        params.append('groupId', selectedGroup)
      }

      const response = await fetch(`/api/tiktok/profiles/posting-activity?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch posting activity')
      }

      return result.data || []
    } catch (err) {
      console.error('Failed to fetch posting activity:', err)
      return []
    }
  }

  // Fetch daily views data from API
  const fetchDailyViewsData = async (): Promise<DailyViewsDataPoint[]> => {
    try {
      const params = new URLSearchParams()

      if (dateRange.from) {
        params.append('dateFrom', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        params.append('dateTo', dateRange.to.toISOString())
      }
      if (selectedGroup && selectedGroup !== 'all') {
        params.append('groupId', selectedGroup)
      }

      const response = await fetch(`/api/tiktok/profiles/daily-views?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch daily views')
      }

      return result.data || []
    } catch (err) {
      console.error('Failed to fetch daily views:', err)
      return []
    }
  }

  const handleRefresh = useCallback(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange)
    updateUrlParams(newDateRange, selectedGroup)
  }, [selectedGroup, updateUrlParams])

  const handleGroupChange = useCallback((newGroup: string) => {
    setSelectedGroup(newGroup)
    updateUrlParams(dateRange, newGroup)
  }, [dateRange, updateUrlParams])

  const handleBulkGroupSuccess = useCallback(() => {
    setSelectedProfiles(new Set())
    fetchProfiles()
  }, [fetchProfiles])

  const handleBulkUpdateNow = useCallback(async () => {
    if (selectedProfiles.size === 0) return

    setIsBulkUpdating(true)
    try {
      const response = await fetch('/api/tiktok/profiles/bulk/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileIds: Array.from(selectedProfiles),
          forceRecache: false
        })
      })

      if (!response.ok) {
        throw new Error('Failed to bulk trigger update')
      }

      const result = await response.json()
      alert(`Successfully queued update for ${result.queuedCount} profile${result.queuedCount > 1 ? 's' : ''}`)

      // Clear selection
      setSelectedProfiles(new Set())
    } catch (err) {
      console.error('Failed to bulk trigger update:', err)
      alert('Failed to queue profile updates. Please try again.')
    } finally {
      setIsBulkUpdating(false)
    }
  }, [selectedProfiles])

  useEffect(() => {
    fetchProfiles()
    fetchGroups()
  }, [fetchProfiles, fetchGroups])

  const formatNumber = (num?: number | null): string => {
    if (!num) return '0'
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <PageLayout
      title="TikTok Profiles"
      headerActions={
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          {/* Group Filter */}
          <Select value={selectedGroup} onValueChange={handleGroupChange}>
            <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              <SelectItem value="ungrouped">Ungrouped</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group.profileCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <DateRangeFilter
            value={dateRange}
            onChange={handleDateRangeChange}
            className="w-full sm:w-auto"
          />

          {/* Bulk Update Now */}
          <Button
            variant="outline"
            onClick={handleBulkUpdateNow}
            disabled={selectedProfiles.size === 0 || isBulkUpdating}
            className="w-full sm:w-auto h-8 px-3 text-xs"
          >
            <Play className={`h-3 w-3 mr-1.5 ${isBulkUpdating ? 'animate-pulse' : ''}`} />
            {isBulkUpdating ? 'Updating...' : `Update Now ${selectedProfiles.size > 0 ? `(${selectedProfiles.size})` : ''}`}
          </Button>

          {/* Bulk Group Assign */}
          <Button
            variant="outline"
            onClick={() => setIsBulkGroupDialogOpen(true)}
            disabled={selectedProfiles.size === 0}
            className="w-full sm:w-auto h-8 px-3 text-xs"
          >
            <FolderPlus className="h-3 w-3 mr-1.5" />
            Assign Group {selectedProfiles.size > 0 && `(${selectedProfiles.size})`}
          </Button>

          {/* Add Profile */}
          <AddProfileDialog onProfileAdded={handleRefresh} />

          {/* Refresh */}
          <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm" className="w-full sm:w-auto h-8 px-3 text-xs">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Metrics and Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-4 px-4 pt-4">
            {/* Metrics Grid - 2x3 */}
            {loading && !currentMetrics ? (
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
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Video className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Posts</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(currentMetrics?.totalPosts)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Views</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(currentMetrics?.totalViews)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-pink-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Avg Views</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(currentMetrics?.avgViews)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Likes</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(currentMetrics?.totalLikes)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Comments</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(currentMetrics?.totalComments)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Bookmark className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Saved</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(currentMetrics?.totalSaves)}</div>
                </div>
              </div>
            )}

            {/* Posting Activity Heatmap */}
            <PostingActivityHeatmap
              data={activityData}
              firstPostDate={null}
              dateRange={dateRange}
            />

            {/* Daily Views Chart */}
            <DailyViewsChart data={dailyViewsData} loading={loading} />
          </div>

          {/* Profiles Table */}
          {profiles.length > 0 ? (
            <ProfilesTable
              profiles={profiles}
              onProfilesChange={handleRefresh}
              selectedProfiles={selectedProfiles}
              onSelectionChange={setSelectedProfiles}
            />
          ) : (loading || !hasLoaded) ? (
            <div className="px-4 pb-4">
              {/* Table Header Skeleton */}
              <div className="flex items-center gap-4 py-3 px-4 border-b border-border">
                <div className="w-5 h-5 bg-muted animate-pulse rounded" />
                <div className="w-20 h-4 bg-muted animate-pulse rounded" />
                <div className="w-32 h-4 bg-muted animate-pulse rounded" />
                <div className="w-24 h-4 bg-muted animate-pulse rounded" />
                <div className="flex-1" />
              </div>
              {/* Table Rows Skeleton */}
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-border">
                  <div className="w-5 h-5 bg-muted animate-pulse rounded" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
                    <div className="space-y-1">
                      <div className="w-28 h-4 bg-muted animate-pulse rounded" />
                      <div className="w-20 h-3 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="w-40 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-20 h-6 bg-muted animate-pulse rounded-full" />
                  <div className="w-12 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-12 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-12 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-12 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-16 h-5 bg-muted animate-pulse rounded-full" />
                  <div className="w-20 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-6 h-6 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No profiles found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {selectedGroup !== 'all'
                    ? 'No profiles in this group. Try selecting a different group or add profiles to this group.'
                    : 'No TikTok profiles have been saved yet. Use the Profile Explorer to fetch and save profiles.'}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Bulk Group Assign Dialog */}
      <BulkGroupAssignDialog
        isOpen={isBulkGroupDialogOpen}
        onClose={() => setIsBulkGroupDialogOpen(false)}
        selectedProfileIds={Array.from(selectedProfiles)}
        onSuccess={handleBulkGroupSuccess}
      />
    </PageLayout>
  )
}

function ProfilesPageSkeleton() {
  return (
    <PageLayout title="TikTok Profiles">
      {/* Metrics and Charts Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-4 px-4 pt-4">
        {/* Metrics Grid Skeleton */}
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

        {/* Posting Activity Skeleton */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="h-5 w-32 bg-muted animate-pulse rounded mb-4" />
          <div className="h-[120px] bg-muted animate-pulse rounded" />
        </div>

        {/* Daily Views Chart Skeleton */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            <div className="flex gap-4">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-[200px] bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="px-4 pb-4 pt-4">
        {/* Table Header */}
        <div className="flex items-center gap-4 py-3 px-4 border-b border-border">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="w-20 h-4 bg-muted animate-pulse rounded" />
          <div className="w-32 h-4 bg-muted animate-pulse rounded" />
          <div className="w-24 h-4 bg-muted animate-pulse rounded" />
          <div className="flex-1" />
        </div>
        {/* Table Rows */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-border">
            <div className="w-5 h-5 bg-muted animate-pulse rounded" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
              <div className="space-y-1">
                <div className="w-28 h-4 bg-muted animate-pulse rounded" />
                <div className="w-20 h-3 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="w-40 h-4 bg-muted animate-pulse rounded" />
            <div className="w-20 h-6 bg-muted animate-pulse rounded-full" />
            <div className="w-12 h-4 bg-muted animate-pulse rounded" />
            <div className="w-12 h-4 bg-muted animate-pulse rounded" />
            <div className="w-12 h-4 bg-muted animate-pulse rounded" />
            <div className="w-12 h-4 bg-muted animate-pulse rounded" />
            <div className="w-16 h-5 bg-muted animate-pulse rounded-full" />
            <div className="w-20 h-4 bg-muted animate-pulse rounded" />
            <div className="w-6 h-6 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    </PageLayout>
  )
}

export default function ProfilesPage() {
  return (
    <Suspense fallback={<ProfilesPageSkeleton />}>
      <ProfilesPageContent />
    </Suspense>
  )
}
