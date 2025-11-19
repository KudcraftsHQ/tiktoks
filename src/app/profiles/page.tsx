'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ProfilesTable } from '@/components/ProfilesTable'
import { Button } from '@/components/ui/button'
import { RefreshCw, Users, Video, Eye, Heart, MessageCircle, Bookmark, FolderPlus } from 'lucide-react'
import { TikTokProfile } from '@/components/profiles-table-columns'
import { PageLayout } from '@/components/PageLayout'
import { AddProfileDialog } from '@/components/AddProfileDialog'
import { DateRange, DateRangeFilter } from '@/components/DateRangeFilter'
import { BulkGroupAssignDialog } from '@/components/BulkGroupAssignDialog'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'
import { DailyViewsChart, DailyViewsDataPoint } from '@/components/DailyViewsChart'
import { calculateProfileAggregateMetrics, compareMetrics } from '@/lib/profile-metrics-calculator'
import { startOfDay, endOfDay, subDays } from 'date-fns'
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

export default function ProfilesPage() {
  // Default to last 7 days
  const defaultDateRange: DateRange = {
    from: startOfDay(subDays(new Date(), 7)),
    to: endOfDay(new Date())
  }

  const [profiles, setProfiles] = useState<TikTokProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalProfiles, setTotalProfiles] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange)
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [groups, setGroups] = useState<ProfileGroup[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
  const [isBulkGroupDialogOpen, setIsBulkGroupDialogOpen] = useState(false)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [dailyViewsData, setDailyViewsData] = useState<DailyViewsDataPoint[]>([])

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

      // Calculate activity data from profiles
      const activity = calculateActivityData(result.profiles)
      setActivityData(activity)

      // Calculate daily views data
      const dailyViews = await calculateDailyViewsData(result.profiles)
      setDailyViewsData(dailyViews)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [selectedGroup, dateRange])

  // Calculate activity data from profiles (based on post publishing dates)
  const calculateActivityData = (profiles: TikTokProfile[]): Array<{ date: string; count: number }> => {
    // This is a placeholder - in reality, you'd need to aggregate post data from all profiles
    // For now, return empty array
    return []
  }

  // Calculate daily views with backfill strategy
  const calculateDailyViewsData = async (profiles: TikTokProfile[]): Promise<DailyViewsDataPoint[]> => {
    // This is a placeholder implementation
    // In reality, you'd need to:
    // 1. Fetch metrics history for all profiles
    // 2. Calculate daily deltas from monitoring start
    // 3. Backfill with average for dates before monitoring
    return []
  }

  const handleRefresh = useCallback(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange)
  }, [])

  const handleGroupChange = useCallback((newGroup: string) => {
    setSelectedGroup(newGroup)
  }, [])

  const handleBulkGroupSuccess = useCallback(() => {
    setSelectedProfiles(new Set())
    fetchProfiles()
  }, [fetchProfiles])

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
          ) : loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Loading profiles...</span>
                </div>
              </CardContent>
            </Card>
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
