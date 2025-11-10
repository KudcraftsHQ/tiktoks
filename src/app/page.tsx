'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Video,
  Eye,
  Heart,
  Users,
  Clipboard,
  LayoutList,
  LayoutGrid,
} from 'lucide-react'
import { PostsTable } from '@/components/PostsTable'
import { Card, CardContent } from '@/components/ui/card'
import { TikTokPost } from '@/components/posts-table-columns'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'
import { toast } from 'sonner'
import { SortingState } from '@tanstack/react-table'
import { ContentAnalysisSidebar } from '@/components/ContentAnalysisSidebar'
import { GenerateContentDrawer } from '@/components/GenerateContentDrawer'
import { cn } from '@/lib/utils'
import { DateRange } from '@/components/DateRangeFilter'
import { PostingTimeChart, PostingTimeChartData, PostingTimeChartBestTime } from '@/components/PostingTimeChart'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  calculateAggregateMetrics,
  calculateTimeAnalysis,
  calculateActivityData,
  getFirstPostDate
} from '@/lib/metrics-calculator'

interface PostsResponse {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
  page: number
  limit: number
  timeAnalysis?: {
    hourlyData: PostingTimeChartData[]
    bestTimes: PostingTimeChartBestTime[]
  }
  aggregateMetrics?: {
    totalPosts: number
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    avgViews: number
  }
  activityData?: Array<{ date: string; count: number }>
  firstPostDate?: string | null
  error?: string
}

function PostsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10)

  // Parse sorting from URL - supports multi-column sorting
  // New format: ?sort=viewCount.desc,likeCount.asc
  // Old format (backward compatible): ?sortBy=viewCount&sortOrder=desc
  const sortParam = searchParams.get('sort')
  const oldSortBy = searchParams.get('sortBy')
  const oldSortOrder = searchParams.get('sortOrder')

  let initialSorting: SortingState = []

  if (sortParam) {
    // New format: multi-column sorting
    initialSorting = sortParam.split(',').map(sort => {
      const [id, direction] = sort.trim().split('.')
      return { id, desc: direction === 'desc' }
    })
  } else if (oldSortBy && oldSortOrder) {
    // Backward compatibility: old single-column format
    initialSorting = [{ id: oldSortBy, desc: oldSortOrder === 'desc' }]
  }
  // Default: no sorting (let API use its default)

  // Parse date range from URL
  const dateFromParam = searchParams.get('dateFrom')
  const dateToParam = searchParams.get('dateTo')
  const initialDateRange: DateRange = {
    from: dateFromParam ? new Date(dateFromParam) : undefined,
    to: dateToParam ? new Date(dateToParam) : undefined
  }

  // Parse category from URL
  const initialCategory = searchParams.get('category') || 'all'

  // Parse view mode from URL
  const initialViewMode = (searchParams.get('view') as 'metrics' | 'content') || 'metrics'

  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [viewMode, setViewMode] = useState<'metrics' | 'content'>(initialViewMode)
  const [totalPosts, setTotalPosts] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory)
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange)
  const [timeAnalysis, setTimeAnalysis] = useState<{
    hourlyData: PostingTimeChartData[]
    bestTimes: PostingTimeChartBestTime[]
  } | null>(null)
  const [aggregateMetrics, setAggregateMetrics] = useState<{
    totalPosts: number
    totalViews: number
    totalLikes: number
    totalComments: number
    totalShares: number
    avgViews: number
  } | null>(null)
  const [activityData, setActivityData] = useState<Array<{ date: string; count: number }>>([])
  const [firstPostDate, setFirstPostDate] = useState<string | null>(null)

  // Selection and Analysis sidebar state
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [isAnalysisSidebarOpen, setIsAnalysisSidebarOpen] = useState(false)
  const [isGenerateDrawerOpen, setIsGenerateDrawerOpen] = useState(false)

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

  // Display metrics: use selected posts metrics if available, otherwise use all posts metrics
  const displayMetrics = useMemo(() => {
    if (!selectedPostsForMetrics) return aggregateMetrics
    return calculateAggregateMetrics(selectedPostsForMetrics)
  }, [selectedPostsForMetrics, aggregateMetrics])

  // Display time analysis: use selected posts data if available
  const displayTimeAnalysis = useMemo(() => {
    if (!selectedPostsForMetrics) return timeAnalysis
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const result = calculateTimeAnalysis(selectedPostsForMetrics, timezone)
    return result
  }, [selectedPostsForMetrics, timeAnalysis])

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
  const updateURL = useCallback((page: number, sort: SortingState, dateFilter: DateRange, category: string, view: 'metrics' | 'content') => {
    const params = new URLSearchParams()

    if (page > 1) {
      params.set('page', page.toString())
    }

    if (sort.length > 0) {
      // New format: multi-column sorting
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

    // Add view mode (only if content mode)
    if (view === 'content') {
      params.set('view', 'content')
    }

    const queryString = params.toString()
    const newUrl = queryString ? `?${queryString}` : '/'

    // Use shallow routing to avoid full page reload
    router.push(newUrl, { scroll: false })
  }, [router])

  const fetchPosts = useCallback(async (page: number, limit: number, sort: SortingState, dateFilter: DateRange, category: string) => {
    setIsLoading(true)
    try {
      // Get client timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        includeTimeAnalysis: 'true',
        includeActivityData: 'true',
        timezone: timezone
      })

      // Add category filter
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

      const response = await fetch(`/api/tiktok/posts?${params}`)
      const data: PostsResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch posts')
      }

      setPosts(data.posts || [])
      setTotalPosts(data.total || 0)
      if (data.timeAnalysis) {
        setTimeAnalysis(data.timeAnalysis)
      }
      if (data.aggregateMetrics) {
        setAggregateMetrics(data.aggregateMetrics)
      }
      if (data.activityData) {
        setActivityData(data.activityData)
      }
      if (data.firstPostDate !== undefined) {
        setFirstPostDate(data.firstPostDate)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch posts')
      setPosts([])
      setTimeAnalysis(null)
    } finally {
      setIsLoading(false)
    }
  }, [])


  // Handle sorting change with URL update
  const handleSortingChange = useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    const newSorting = typeof updaterOrValue === 'function'
      ? updaterOrValue(sorting)
      : updaterOrValue

    setSorting(newSorting)

    // Update URL and fetch in a separate effect to avoid render issues
    setTimeout(() => {
      updateURL(currentPage, newSorting, dateRange, categoryFilter, viewMode)
      fetchPosts(currentPage, pageSize, newSorting, dateRange, categoryFilter)
    }, 0)
  }, [currentPage, pageSize, sorting, categoryFilter, dateRange, viewMode, updateURL, fetchPosts])

  // Handle page change with URL update
  const handlePageChange = useCallback((pageIndex: number, newPageSize: number) => {
    const newPage = pageIndex + 1 // Convert 0-based to 1-based
    setCurrentPage(newPage)
    setPageSize(newPageSize)

    setSorting(currentSorting => {
      updateURL(newPage, currentSorting, dateRange, categoryFilter, viewMode)
      fetchPosts(newPage, newPageSize, currentSorting, dateRange, categoryFilter)
      return currentSorting
    })
  }, [categoryFilter, dateRange, viewMode, updateURL, fetchPosts])

  // Handle date range change with URL update
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange)
    setCurrentPage(1) // Reset to first page when filter changes

    // Update URL and fetch
    setTimeout(() => {
      updateURL(1, sorting, newDateRange, categoryFilter, viewMode)
      fetchPosts(1, pageSize, sorting, newDateRange, categoryFilter)
    }, 0)
  }, [pageSize, sorting, categoryFilter, viewMode, updateURL, fetchPosts])

  // Handle category change with URL update
  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategoryFilter(newCategory)
    setCurrentPage(1) // Reset to first page when filter changes

    // Update URL and fetch
    setTimeout(() => {
      updateURL(1, sorting, dateRange, newCategory, viewMode)
      fetchPosts(1, pageSize, sorting, dateRange, newCategory)
    }, 0)
  }, [pageSize, sorting, dateRange, viewMode, updateURL, fetchPosts])

  // Handle refetch (e.g., after updating slide classification)
  const handleRefetchPosts = useCallback(() => {
    fetchPosts(currentPage, pageSize, sorting, dateRange, categoryFilter)
  }, [currentPage, pageSize, sorting, dateRange, categoryFilter, fetchPosts])

  // Handle content generated callback
  const handleContentGenerated = useCallback(() => {
    // Navigation is handled by GenerateContentDrawer
    // This callback is kept for potential future use
  }, [])

  // Sync state from URL params (for browser back/forward)
  useEffect(() => {
    const sortParam = searchParams.get('sort')
    const oldSortBy = searchParams.get('sortBy')
    const oldSortOrder = searchParams.get('sortOrder')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')
    const categoryParam = searchParams.get('category') || 'all'

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
    const categoryDifferent = categoryParam !== categoryFilter

    if (sortingDifferent || dateDifferent || categoryDifferent) {
      if (sortingDifferent) setSorting(urlSorting)
      if (dateDifferent) setDateRange(urlDateRange)
      if (categoryDifferent) setCategoryFilter(categoryParam)
      fetchPosts(currentPage, pageSize, urlSorting, urlDateRange, categoryParam)
    }
  }, [searchParams, sorting, dateRange, categoryFilter, currentPage, pageSize, fetchPosts])

  // Initial fetch
  useEffect(() => {
    fetchPosts(initialPage, pageSize, initialSorting, initialDateRange, initialCategory)
  }, [])

  // Sync viewMode from URL
  useEffect(() => {
    const urlViewMode = (searchParams.get('view') as 'metrics' | 'content') || 'metrics'
    if (urlViewMode !== viewMode) {
      setViewMode(urlViewMode)
    }
  }, [searchParams, viewMode])


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

  const [isCopyingToClipboard, setIsCopyingToClipboard] = useState(false)

  const handleCopyToClipboard = useCallback(async () => {
    if (selectedPosts.size === 0) return

    setIsCopyingToClipboard(true)
    try {
      // Filter selected posts from the posts array
      const selectedPostsData = posts.filter(p => selectedPosts.has(p.id))

      // Format posts data
      const formattedPosts = selectedPostsData.map(post => ({
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
          images: (post.images || []).map(img => ({
            imageId: img.cacheAssetId || null,
            ocrText: post.ocrTexts?.[img.cacheAssetId] || undefined
          }))
        },
        ocrText: post.ocrTexts ? Object.values(post.ocrTexts).filter(Boolean).join('\n') : null
      }))

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
    <div className="flex h-screen w-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PageLayout
          title="TikTok Posts"
          headerActions={
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => {
                  if (value) {
                    const newViewMode = value as 'metrics' | 'content'
                    setViewMode(newViewMode)
                    updateURL(currentPage, sorting, dateRange, categoryFilter, newViewMode)
                  }
                }}
                className="border h-8"
              >
                <ToggleGroupItem value="metrics" className="gap-1.5 h-8 px-3 text-xs">
                  <LayoutList className="h-3 w-3" />
                  <span>Metrics</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="content" className="gap-1.5 h-8 px-3 text-xs">
                  <LayoutGrid className="h-3 w-3" />
                  <span>Content</span>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                onClick={handleCopyToClipboard}
                disabled={selectedPosts.size === 0 || isCopyingToClipboard}
                className="w-full sm:w-auto h-8 px-3 text-xs"
              >
                <Clipboard className="h-3 w-3 mr-1.5" />
                Copy to Clipboard {selectedPosts.size > 0 && `(${selectedPosts.size})`}
              </Button>
              <Button
                variant={isGenerateDrawerOpen ? "default" : "outline"}
                onClick={() => setIsGenerateDrawerOpen(!isGenerateDrawerOpen)}
                className="w-full sm:w-auto h-8 px-3 text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1.5" />
                Generate Content {selectedPosts.size > 0 && `(${selectedPosts.size})`}
              </Button>
              <Button
                variant={isAnalysisSidebarOpen ? "default" : "outline"}
                onClick={() => setIsAnalysisSidebarOpen(!isAnalysisSidebarOpen)}
                className="w-full sm:w-auto h-8 px-3 text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1.5" />
                Chat with Data {selectedPosts.size > 0 && `(${selectedPosts.size})`}
              </Button>
            </div>
          }
        >
          {viewMode === 'metrics' ? (
            <>
              {/* Metrics and Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-4">
            {/* Metrics Grid - 2x3 */}
            {isLoading && !displayMetrics ? (
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
                  <div className="text-2xl font-bold">{formatNumber(displayMetrics?.totalPosts)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Views</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(displayMetrics?.totalViews)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-pink-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Avg Views</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(displayMetrics?.avgViews)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Likes</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(displayMetrics?.totalLikes)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Comments</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(displayMetrics?.totalComments)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">Saved</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(displayMetrics?.totalShares)}</div>
                </div>
              </div>
            )}

            {/* Posting Activity Heatmap */}
            <PostingActivityHeatmap data={displayActivityData} firstPostDate={displayFirstPostDate} />

            {/* Posting Time Chart */}
            <PostingTimeChart
              data={displayTimeAnalysis?.hourlyData || []}
              bestTimes={displayTimeAnalysis?.bestTimes || []}
              loading={isLoading && !displayTimeAnalysis}
            />
              </div>

              {/* Posts Table */}
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
                isLoading={isLoading}
                selectedPosts={selectedPosts}
                onSelectionChange={setSelectedPosts}
                viewMode={viewMode}
              />
            </>
          ) : (
            /* Content Mode: Full Height Posts Table */
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
              isLoading={isLoading}
              selectedPosts={selectedPosts}
              onSelectionChange={setSelectedPosts}
              viewMode={viewMode}
            />
          )}
        </PageLayout>
      </div>

      {/* Generate Content Sidebar - spans full height */}
      <GenerateContentDrawer
        isOpen={isGenerateDrawerOpen}
        onClose={() => setIsGenerateDrawerOpen(false)}
        selectedPostIds={Array.from(selectedPosts)}
        onContentGenerated={handleContentGenerated}
      />

      {/* Content Analysis Sidebar - spans full height */}
      <ContentAnalysisSidebar
        isOpen={isAnalysisSidebarOpen}
        onClose={() => setIsAnalysisSidebarOpen(false)}
        selectedPosts={selectedPostsData}
        onRemovePost={handleRemovePost}
        onClearSelection={handleClearSelection}
      />
    </div>
  )
}

export default function PostsPage() {
  return (
    <Suspense fallback={
      <PageLayout title="TikTok Posts" description="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    }>
      <PostsPageContent />
    </Suspense>
  )
}