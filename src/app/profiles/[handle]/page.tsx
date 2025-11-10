'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
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
  ChevronLeft,
  Sparkles,
  Clipboard
} from 'lucide-react'
import { TikTokPost } from '@/components/posts-table-columns'
import { TikTokProfile } from '@/components/profiles-table-columns'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { designTokens } from '@/lib/design-tokens'
import { PageLayout } from '@/components/PageLayout'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'
import { SortingState } from '@tanstack/react-table'
import { ContentAnalysisSidebar } from '@/components/ContentAnalysisSidebar'
import { cn } from '@/lib/utils'
import { DateRange } from '@/components/DateRangeFilter'
import { PostingTimeChart, PostingTimeChartData, PostingTimeChartBestTime } from '@/components/PostingTimeChart'
import {
  calculateAggregateMetrics,
  calculateTimeAnalysis,
  calculateActivityData,
  getFirstPostDate
} from '@/lib/metrics-calculator'

interface ProfilePostsResult {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
  page: number
  limit: number
  error?: string
}

interface TimeAnalysisResult {
  data: {
    hourlyData: PostingTimeChartData[]
    bestTimes: PostingTimeChartBestTime[]
  }
}

function ProfileDetailPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const handle = params.handle as string

  // Initialize state from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10)

  // Parse sorting from URL - supports multi-column sorting
  const sortParam = searchParams.get('sort')
  const oldSortBy = searchParams.get('sortBy')
  const oldSortOrder = searchParams.get('sortOrder')

  let initialSorting: SortingState = []

  if (sortParam) {
    initialSorting = sortParam.split(',').map(sort => {
      const [id, direction] = sort.trim().split('.')
      return { id, desc: direction === 'desc' }
    })
  } else if (oldSortBy && oldSortOrder) {
    initialSorting = [{ id: oldSortBy, desc: oldSortOrder === 'desc' }]
  }

  // Parse date range from URL
  const dateFromParam = searchParams.get('dateFrom')
  const dateToParam = searchParams.get('dateTo')
  const initialDateRange: DateRange = {
    from: dateFromParam ? new Date(dateFromParam) : undefined,
    to: dateToParam ? new Date(dateToParam) : undefined
  }

  // Parse category from URL
  const initialCategory = searchParams.get('category') || 'all'

  const [profile, setProfile] = useState<TikTokProfile | null>(null)
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPosts, setTotalPosts] = useState(0)
  const [monitoringEnabled, setMonitoringEnabled] = useState(false)
  const [monitoringLoading, setMonitoringLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [firstPostDate, setFirstPostDate] = useState<string | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange)
  const [timeAnalysisData, setTimeAnalysisData] = useState<{
    hourlyData: PostingTimeChartData[]
    bestTimes: PostingTimeChartBestTime[]
  } | null>(null)
  const [timeAnalysisLoading, setTimeAnalysisLoading] = useState(false)

  // Selection and Analysis sidebar state
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [isAnalysisSidebarOpen, setIsAnalysisSidebarOpen] = useState(false)

  // Don't auto-close sidebar when posts are deselected
  // useEffect(() => {
  //   if (selectedPosts.size === 0) {
  //     setIsAnalysisSidebarOpen(false)
  //   }
  // }, [selectedPosts])

  // Compute metrics from selected posts when selection exists
  const selectedPostsForMetrics = useMemo(() => {
    if (selectedPosts.size === 0) return null
    return posts.filter(p => selectedPosts.has(p.id))
  }, [posts, selectedPosts])

  // Display metrics: use selected posts metrics if available, otherwise use profile-level metrics
  const displayMetrics = useMemo(() => {
    if (!selectedPostsForMetrics) {
      // Use profile-level metrics
      return {
        totalPosts: profile?.totalPosts || 0,
        totalViews: parseInt(profile?.totalViews?.toString() || '0'),
        totalLikes: parseInt(profile?.totalLikes?.toString() || '0'),
        totalComments: parseInt(profile?.totalComments?.toString() || '0'),
        totalShares: parseInt(profile?.totalShares?.toString() || '0'),
        avgViews: profile?.totalPosts && profile.totalPosts > 0
          ? Math.round(parseInt(profile.totalViews?.toString() || '0') / profile.totalPosts)
          : 0
      }
    }
    return calculateAggregateMetrics(selectedPostsForMetrics)
  }, [selectedPostsForMetrics, profile])

  // Display time analysis: use selected posts data if available
  const displayTimeAnalysis = useMemo(() => {
    if (!selectedPostsForMetrics) return timeAnalysisData
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const result = calculateTimeAnalysis(selectedPostsForMetrics, timezone)
    return result
  }, [selectedPostsForMetrics, timeAnalysisData])

  // Display activity data: use selected posts data if available
  const displayActivityData = useMemo(() => {
    if (!selectedPostsForMetrics) return activityData
    return calculateActivityData(selectedPostsForMetrics)
  }, [selectedPostsForMetrics, activityData])

  // Display first post date: use selected posts data if available
  const displayFirstPostDate = useMemo(() => {
    if (!selectedPostsForMetrics) return firstPostDate
    return getFirstPostDate(selectedPostsForMetrics)
  }, [selectedPostsForMetrics, firstPostDate])

  // Update URL with current state
  const updateURL = useCallback((page: number, sort: SortingState, dateFilter: DateRange, category: string) => {
    const params = new URLSearchParams()

    if (page > 1) {
      params.set('page', page.toString())
    }

    if (sort.length > 0) {
      const sortParam = sort
        .map(s => `${s.id}.${s.desc ? 'desc' : 'asc'}`)
        .join(',')
      params.set('sort', sortParam)
    }

    // Add date range params
    if (dateFilter.from) {
      params.set('dateFrom', dateFilter.from.toISOString())
    }
    if (dateFilter.to) {
      params.set('dateTo', dateFilter.to.toISOString())
    }

    // Add category filter
    if (category && category !== 'all') {
      params.set('category', category)
    }

    const queryString = params.toString()
    const newUrl = queryString ? `?${queryString}` : ''

    // Use shallow routing to avoid full page reload
    router.push(`/profiles/${handle}${newUrl}`, { scroll: false })
  }, [router, handle])

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

  const fetchProfilePosts = useCallback(async (page: number, sort: SortingState, dateFilter: DateRange, category: string) => {
    if (!profile?.id) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })

      if (category && category !== 'all') {
        params.append('categoryId', category)
      }

      // Add sorting parameters
      if (sort.length > 0) {
        const sortParam = sort
          .map(s => `${s.id}.${s.desc ? 'desc' : 'asc'}`)
          .join(',')
        params.append('sort', sortParam)
      }

      // Add date range parameters
      if (dateFilter.from) {
        params.append('dateFrom', dateFilter.from.toISOString())
      }
      if (dateFilter.to) {
        params.append('dateTo', dateFilter.to.toISOString())
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
  }, [profile?.id])

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

  const fetchTimeAnalysisData = useCallback(async () => {
    if (!profile?.id) return

    setTimeAnalysisLoading(true)
    try {
      // Get client timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      const params = new URLSearchParams({
        timezone: timezone
      })
      if (dateRange.from) {
        params.append('dateFrom', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        params.append('dateTo', dateRange.to.toISOString())
      }

      const response = await fetch(`/api/tiktok/profiles/${profile.id}/time-analysis?${params}`)
      const result: TimeAnalysisResult = await response.json()

      if (!response.ok) {
        throw new Error('Failed to fetch time analysis data')
      }

      setTimeAnalysisData(result.data || null)
    } catch (err) {
      console.error('Failed to fetch time analysis data:', err)
      setTimeAnalysisData(null)
    } finally {
      setTimeAnalysisLoading(false)
    }
  }, [profile?.id, dateRange])

  const handleRefresh = useCallback(() => {
    fetchProfile()
    fetchProfilePosts(currentPage, sorting, dateRange, categoryFilter)
    fetchActivityData()
    fetchTimeAnalysisData()
  }, [fetchProfile, fetchProfilePosts, fetchActivityData, fetchTimeAnalysisData, currentPage, sorting, categoryFilter, dateRange])

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

  // Sync state from URL params (for browser back/forward)
  useEffect(() => {
    const sortParam = searchParams.get('sort')
    const oldSortBy = searchParams.get('sortBy')
    const oldSortOrder = searchParams.get('sortOrder')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    let urlSorting: SortingState = []

    if (sortParam) {
      urlSorting = sortParam.split(',').map(sort => {
        const [id, direction] = sort.trim().split('.')
        return { id, desc: direction === 'desc' }
      })
    } else if (oldSortBy && oldSortOrder) {
      urlSorting = [{ id: oldSortBy, desc: oldSortOrder === 'desc' }]
    }

    const urlDateRange: DateRange = {
      from: dateFromParam ? new Date(dateFromParam) : undefined,
      to: dateToParam ? new Date(dateToParam) : undefined
    }

    // Check if URL state is different from current state
    const sortingDifferent = JSON.stringify(urlSorting) !== JSON.stringify(sorting)
    const dateDifferent = JSON.stringify(urlDateRange) !== JSON.stringify(dateRange)

    if (sortingDifferent) {
      setSorting(urlSorting)
    }
    if (dateDifferent) {
      setDateRange(urlDateRange)
    }
  }, [searchParams, sorting, dateRange])

  // Load profile and posts on mount and when filters change
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (profile?.id) {
      fetchProfilePosts(currentPage, sorting, dateRange, categoryFilter)
    }
  }, [profile?.id, currentPage, sorting, categoryFilter, dateRange, fetchProfilePosts])

  useEffect(() => {
    fetchActivityData()
  }, [fetchActivityData])

  useEffect(() => {
    fetchTimeAnalysisData()
  }, [fetchTimeAnalysisData])

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


  // Get selected posts data for sidebar
  const selectedPostsData = posts
    .filter(p => selectedPosts.has(p.id))
    .map(p => ({
      id: p.id,
      authorHandle: p.authorHandle || 'unknown',
      authorAvatarId: p.authorAvatarId,
      description: p.description,
      contentType: p.contentType,
      images: p.images
    }))

  const handleRemovePost = (postId: string) => {
    setSelectedPosts(prev => {
      const newSet = new Set(prev)
      newSet.delete(postId)
      return newSet
    })
  }

  const handleClearSelection = () => {
    setSelectedPosts(new Set())
  }

  const handleRestorePosts = (postIds: string[]) => {
    setSelectedPosts(new Set(postIds))
  }

  const [isCopyingToClipboard, setIsCopyingToClipboard] = useState(false)

  const handleCopyToClipboard = useCallback(async () => {
    if (selectedPosts.size === 0) return

    setIsCopyingToClipboard(true)
    try {
      // Filter selected posts from the posts array
      const selectedPostsData = posts.filter(p => selectedPosts.has(p.id))

      // Format posts data
      const formattedPosts = selectedPostsData.map(post => {
        // Parse ocrTexts if it's a string
        let parsedOcrTexts: any = null
        try {
          if (typeof post.ocrTexts === 'string') {
            parsedOcrTexts = JSON.parse(post.ocrTexts)
          } else if (post.ocrTexts && typeof post.ocrTexts === 'object') {
            parsedOcrTexts = post.ocrTexts
          }
        } catch (error) {
          console.warn('Failed to parse ocrTexts for post:', post.id, error)
        }

        return {
          id: post.id,
          description: post.description || '',
          contentType: post.contentType,
          createTime: post.publishedAt,
          metrics: {
            views: post.viewCount || 0,
            likes: post.likeCount || 0,
            comments: post.commentCount || 0,
            shares: post.shareCount || 0,
            plays: post.duration ? Math.ceil(post.viewCount / (post.duration / 60)) : 0
          },
          author: {
            handle: post.authorHandle || 'unknown',
            avatarId: post.authorAvatarId || null
          },
          media: {
            videoId: post.videoId || null,
            coverId: post.coverId || null,
            musicId: post.musicId || null,
            images: (post.images || []).map((img, index) => ({
              imageId: img.cacheAssetId || null
            }))
          },
          ocrText: parsedOcrTexts && Array.isArray(parsedOcrTexts) ? parsedOcrTexts : null
        }
      })

      // Create JSON data structure
      const clipboardData = {
        posts: formattedPosts,
        summary: {
          totalPosts: formattedPosts.length,
          exportedAt: new Date().toISOString()
        }
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(JSON.stringify(clipboardData, null, 2))

      // Show success toast
      toast.success(`Copied ${selectedPosts.size} post${selectedPosts.size !== 1 ? 's' : ''} to clipboard`, {
        description: 'Post data is ready to paste'
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard', {
        description: 'Please try again'
      })
    } finally {
      setIsCopyingToClipboard(false)
    }
  }, [selectedPosts, posts])

  // Handle sorting change with URL update
  const handleSortingChange = useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    const newSorting = typeof updaterOrValue === 'function'
      ? updaterOrValue(sorting)
      : updaterOrValue

    setSorting(newSorting)

    // Update URL in a separate effect to avoid render issues
    setTimeout(() => {
      updateURL(currentPage, newSorting, dateRange, categoryFilter)
    }, 0)
  }, [currentPage, sorting, categoryFilter, dateRange, updateURL])

  // Handle page change with URL update
  // Note: DataTable calls this with the NEW pageIndex (0-indexed) after navigation
  const handlePageChange = useCallback((pageIndex: number, pageSize: number) => {
    const newPage = pageIndex + 1 // Convert 0-indexed to 1-indexed for URL
    setCurrentPage(newPage)

    setSorting(currentSorting => {
      updateURL(newPage, currentSorting, dateRange, categoryFilter)
      return currentSorting
    })
  }, [dateRange, categoryFilter, updateURL])

  // Handle date range change with URL update
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange)
    setCurrentPage(1) // Reset to first page when filter changes

    // Update URL and trigger refetch
    setTimeout(() => {
      updateURL(1, sorting, newDateRange, categoryFilter)
    }, 0)
  }, [sorting, categoryFilter, updateURL])

  // Handle category change with URL update
  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategoryFilter(newCategory)
    setCurrentPage(1) // Reset to first page when filter changes

    // Update URL and trigger refetch
    setTimeout(() => {
      updateURL(1, sorting, dateRange, newCategory)
    }, 0)
  }, [sorting, dateRange, updateURL])

  // Handle refetch (e.g., after updating slide classification)
  const handleRefetchPosts = useCallback(() => {
    fetchProfilePosts(currentPage, sorting, dateRange, categoryFilter)
  }, [fetchProfilePosts, currentPage, sorting, dateRange, categoryFilter])

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
    <div className="flex h-screen w-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            disabled={selectedPosts.size === 0 || isCopyingToClipboard}
            size="sm"
          >
            <Clipboard className="h-4 w-4 mr-2" />
            Copy {selectedPosts.size > 0 && `(${selectedPosts.size})`}
          </Button>
          <Button
            variant={isAnalysisSidebarOpen ? "default" : "outline"}
            onClick={() => setIsAnalysisSidebarOpen(!isAnalysisSidebarOpen)}
            size="sm"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Chat with Data {selectedPosts.size > 0 && `(${selectedPosts.size})`}
          </Button>
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
        <div className="space-y-4">
          {/* Metrics Grid and Heatmap Row */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-4">
            {/* Metrics Grid - 2x3 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">Posts</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(displayMetrics.totalPosts)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Views</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(displayMetrics.totalViews)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-pink-500" />
                </div>
                <span className="text-sm text-muted-foreground">Avg Views</span>
              </div>
              <div className="text-2xl font-bold">
                {formatNumber(displayMetrics.avgViews)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">Likes</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(displayMetrics.totalLikes)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">Comments</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(displayMetrics.totalComments)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Saved</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(displayMetrics.totalShares)}</div>
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
              <PostingActivityHeatmap data={displayActivityData} firstPostDate={displayFirstPostDate} />
            )}
            {/* Posting Time Analysis Chart */}
            {timeAnalysisLoading ? (
              <div className="rounded-lg border border-border bg-card">
                <div className="p-4 pb-3">
                  <div className="h-6 w-40 bg-muted animate-pulse rounded" />
                </div>
                <div className="p-4 pt-0">
                  <div className="space-y-2">
                    <div className="h-24 w-full bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </div>
            ) : displayTimeAnalysis ? (
              <PostingTimeChart
                data={displayTimeAnalysis.hourlyData}
                bestTimes={displayTimeAnalysis.bestTimes}
                loading={false}
              />
            ) : null}
          </div>
        </div>

        {/* Posts Table - Takes remaining height, filter is inside */}
        {posts.length > 0 ? (
          <div className="min-h-0">
            <PostsTable
              posts={posts}
              totalPosts={totalPosts}
              categoryFilter={{
                value: categoryFilter,
                onChange: handleCategoryChange
              }}
              dateRangeFilter={{
                value: dateRange,
                onChange: handleDateRangeChange
              }}
              onPageChange={handlePageChange}
              onSortingChange={handleSortingChange}
              onRefetchPosts={handleRefetchPosts}
              sorting={sorting}
              enableServerSideSorting={true}
              hiddenColumns={['authorHandle']}
              selectedPosts={selectedPosts}
              onSelectionChange={setSelectedPosts}
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
      </div>

      {/* Sidebar - spans full height */}
      <ContentAnalysisSidebar
        isOpen={isAnalysisSidebarOpen}
        onClose={() => setIsAnalysisSidebarOpen(false)}
        selectedPosts={selectedPostsData}
        onRemovePost={handleRemovePost}
        onClearSelection={handleClearSelection}
        onRestorePosts={handleRestorePosts}
      />
    </div>
  )
}

export default function ProfileDetailPage() {
  return (
    <Suspense fallback={
      <PageLayout title="Profile" description="Loading profile...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    }>
      <ProfileDetailPageContent />
    </Suspense>
  )
}
