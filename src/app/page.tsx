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
  MessageSquareIcon,
  FolderPlus,
} from 'lucide-react'
import { PostsTable } from '@/components/PostsTable'
import { Card, CardContent } from '@/components/ui/card'
import { TikTokPost } from '@/components/posts-table-columns'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'
import { toast } from 'sonner'
import { SortingState } from '@tanstack/react-table'
import { ContentAnalysisSidebar } from '@/components/ContentAnalysisSidebar'
import { ProjectSelectorModal } from '@/components/ProjectSelectorModal'
import { cn } from '@/lib/utils'
import { DateRange } from '@/components/DateRangeFilter'
import { PostingTimeChart, PostingTimeChartData, PostingTimeChartBestTime } from '@/components/PostingTimeChart'
import { PostingActivityHeatmap } from '@/components/PostingActivityHeatmap'
import { SearchInput } from '@/components/SearchInput'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AdvancedFilters, AdvancedFiltersValue } from '@/components/AdvancedFilters'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
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

  // Parse search from URL
  const initialSearch = searchParams.get('search') || ''

  // Parse advanced filters from URL
  const accountIdsParam = searchParams.get('accountIds')
  const initialAdvancedFilters: AdvancedFiltersValue = {
    accountIds: accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : [],
    viewCountGt: searchParams.get('viewCountGt') ? parseInt(searchParams.get('viewCountGt')!) : undefined,
    viewCountLt: searchParams.get('viewCountLt') ? parseInt(searchParams.get('viewCountLt')!) : undefined
  }

  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [viewMode, setViewMode] = useState<'metrics' | 'content'>(initialViewMode)
  const [totalPosts, setTotalPosts] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory)
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange)
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch)
  const [isSearching, setIsSearching] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersValue>(initialAdvancedFilters)
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
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false)

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
  const updateURL = useCallback((page: number, sort: SortingState, dateFilter: DateRange, category: string, view: 'metrics' | 'content', search: string, filters: AdvancedFiltersValue) => {
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

    // Add search query
    if (search && search.trim().length > 0) {
      params.set('search', search.trim())
    }

    // Add advanced filters
    if (filters.accountIds.length > 0) {
      params.set('accountIds', filters.accountIds.join(','))
    }
    if (filters.viewCountGt) {
      params.set('viewCountGt', filters.viewCountGt.toString())
    }
    if (filters.viewCountLt) {
      params.set('viewCountLt', filters.viewCountLt.toString())
    }

    const queryString = params.toString()
    const newUrl = queryString ? `?${queryString}` : '/'

    // Use shallow routing to avoid full page reload
    router.push(newUrl, { scroll: false })
  }, [router])

  const fetchPosts = useCallback(async (page: number, limit: number, sort: SortingState, dateFilter: DateRange, category: string, search: string, filters: AdvancedFiltersValue): Promise<void> => {
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

      // Add search query
      if (search && search.trim().length > 0) {
        params.append('search', search.trim())
      }

      // Add advanced filters
      if (filters.accountIds.length > 0) {
        params.append('accountIds', filters.accountIds.join(','))
      }
      if (filters.viewCountGt) {
        params.append('viewCountGt', filters.viewCountGt.toString())
      }
      if (filters.viewCountLt) {
        params.append('viewCountLt', filters.viewCountLt.toString())
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
      updateURL(currentPage, newSorting, dateRange, categoryFilter, viewMode, searchQuery, advancedFilters)
      fetchPosts(currentPage, pageSize, newSorting, dateRange, categoryFilter, searchQuery, advancedFilters)
    }, 0)
  }, [currentPage, pageSize, sorting, categoryFilter, dateRange, viewMode, searchQuery, advancedFilters, updateURL, fetchPosts])

  // Handle page change with URL update
  const handlePageChange = useCallback((pageIndex: number, newPageSize: number) => {
    const newPage = pageIndex + 1 // Convert 0-based to 1-based
    setCurrentPage(newPage)
    setPageSize(newPageSize)

    setSorting(currentSorting => {
      updateURL(newPage, currentSorting, dateRange, categoryFilter, viewMode, searchQuery, advancedFilters)
      fetchPosts(newPage, newPageSize, currentSorting, dateRange, categoryFilter, searchQuery, advancedFilters)
      return currentSorting
    })
  }, [categoryFilter, dateRange, viewMode, searchQuery, advancedFilters, updateURL, fetchPosts])

  // Handle date range change with URL update
  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange)
    setCurrentPage(1) // Reset to first page when filter changes

    // Update URL and fetch
    setTimeout(() => {
      updateURL(1, sorting, newDateRange, categoryFilter, viewMode, searchQuery, advancedFilters)
      fetchPosts(1, pageSize, sorting, newDateRange, categoryFilter, searchQuery, advancedFilters)
    }, 0)
  }, [pageSize, sorting, categoryFilter, viewMode, searchQuery, advancedFilters, updateURL, fetchPosts])

  // Handle category change with URL update
  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategoryFilter(newCategory)
    setCurrentPage(1) // Reset to first page when filter changes

    // Update URL and fetch
    setTimeout(() => {
      updateURL(1, sorting, dateRange, newCategory, viewMode, searchQuery, advancedFilters)
      fetchPosts(1, pageSize, sorting, dateRange, newCategory, searchQuery, advancedFilters)
    }, 0)
  }, [pageSize, sorting, dateRange, viewMode, searchQuery, advancedFilters, updateURL, fetchPosts])

  // Handle search query change with URL update
  const handleSearchChange = useCallback((newSearch: string) => {
    setSearchQuery(newSearch)
    setCurrentPage(1) // Reset to first page when search changes
    setIsSearching(true) // Start search loading

    // Update URL and fetch
    setTimeout(() => {
      updateURL(1, sorting, dateRange, categoryFilter, viewMode, newSearch, advancedFilters)
      fetchPosts(1, pageSize, sorting, dateRange, categoryFilter, newSearch, advancedFilters).finally(() => {
        setIsSearching(false) // End search loading
      })
    }, 0)
  }, [pageSize, sorting, dateRange, categoryFilter, viewMode, advancedFilters, updateURL, fetchPosts])

  // Handle advanced filters change with URL update
  const handleAdvancedFiltersChange = useCallback((newFilters: AdvancedFiltersValue) => {
    setAdvancedFilters(newFilters)
    setCurrentPage(1) // Reset to first page when filters change

    // Update URL and fetch
    setTimeout(() => {
      updateURL(1, sorting, dateRange, categoryFilter, viewMode, searchQuery, newFilters)
      fetchPosts(1, pageSize, sorting, dateRange, categoryFilter, searchQuery, newFilters)
    }, 0)
  }, [pageSize, sorting, dateRange, categoryFilter, viewMode, searchQuery, updateURL, fetchPosts])

  // Handle refetch (e.g., after updating slide classification)
  const handleRefetchPosts = useCallback(() => {
    fetchPosts(currentPage, pageSize, sorting, dateRange, categoryFilter, searchQuery, advancedFilters)
  }, [currentPage, pageSize, sorting, dateRange, categoryFilter, searchQuery, advancedFilters, fetchPosts])


  // Sync state from URL params (for browser back/forward)
  useEffect(() => {
    const sortParam = searchParams.get('sort')
    const oldSortBy = searchParams.get('sortBy')
    const oldSortOrder = searchParams.get('sortOrder')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')
    const categoryParam = searchParams.get('category') || 'all'
    const searchParam = searchParams.get('search') || ''
    const accountIdsParam = searchParams.get('accountIds')
    const viewCountGtParam = searchParams.get('viewCountGt')
    const viewCountLtParam = searchParams.get('viewCountLt')

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

    const urlAdvancedFilters: AdvancedFiltersValue = {
      accountIds: accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : [],
      viewCountGt: viewCountGtParam ? parseInt(viewCountGtParam) : undefined,
      viewCountLt: viewCountLtParam ? parseInt(viewCountLtParam) : undefined
    }

    // Check if URL state is different from current state
    const sortingDifferent = JSON.stringify(urlSorting) !== JSON.stringify(sorting)
    const dateDifferent = JSON.stringify(urlDateRange) !== JSON.stringify(dateRange)
    const categoryDifferent = categoryParam !== categoryFilter
    const searchDifferent = searchParam !== searchQuery
    const filtersDifferent = JSON.stringify(urlAdvancedFilters) !== JSON.stringify(advancedFilters)

    if (sortingDifferent || dateDifferent || categoryDifferent || searchDifferent || filtersDifferent) {
      if (sortingDifferent) setSorting(urlSorting)
      if (dateDifferent) setDateRange(urlDateRange)
      if (categoryDifferent) setCategoryFilter(categoryParam)
      if (searchDifferent) setSearchQuery(searchParam)
      if (filtersDifferent) setAdvancedFilters(urlAdvancedFilters)
      fetchPosts(currentPage, pageSize, urlSorting, urlDateRange, categoryParam, searchParam, urlAdvancedFilters)
    }
  }, [searchParams, sorting, dateRange, categoryFilter, searchQuery, advancedFilters, currentPage, pageSize, fetchPosts])

  // Initial fetch
  useEffect(() => {
    fetchPosts(initialPage, pageSize, initialSorting, initialDateRange, initialCategory, initialSearch, initialAdvancedFilters)
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

      // Format posts as markdown
      const markdownContent = selectedPostsData.map((post, index) => {
        const sections: string[] = []

        // Post counter as H1
        sections.push(`# Post #${index + 1}`)
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

        return sections.join('\n')
      }).join('\n---\n\n')

      // Copy to clipboard
      await navigator.clipboard.writeText(markdownContent)

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

  const handleAddToProject = async (projectId: string) => {
    const postIds = Array.from(selectedPosts)
    try {
      const response = await fetch(`/api/projects/${projectId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add posts to project')
      }

      toast.success(data.message || `Added ${postIds.length} post${postIds.length !== 1 ? 's' : ''} to project`, {
        description: 'View project to see them',
        action: {
          label: 'View Project',
          onClick: () => router.push(`/projects/${projectId}`)
        }
      })

      // Clear selection after successful add
      setSelectedPosts(new Set())
    } catch (error) {
      console.error('Failed to add posts to project:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add posts to project')
    }
  }

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
    <div className="flex h-screen w-full min-w-0">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PageLayout
          title={
            <div className="flex items-center gap-4">
              <SearchInput
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search posts..."
                isLoading={isSearching}
              />
            </div>
          }
          headerActions={
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                <AdvancedFilters
                  value={advancedFilters}
                  onChange={handleAdvancedFiltersChange}
                />
                {viewMode === 'content' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 px-3 text-xs gap-1.5"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                        {sorting.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="absolute -right-1.5 -bottom-1.5 h-4 w-4 flex items-center justify-center rounded-full p-0 text-[10px] border border-background"
                          >
                            {sorting.length}
                          </Badge>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Sort By</h4>
                          <Select
                            value={sorting[0]?.id || ''}
                            onValueChange={(value) => {
                              const newSorting: SortingState = value
                                ? [{ id: value, desc: sorting[0]?.desc ?? true }]
                                : []
                              handleSortingChange(newSorting)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewCount">Views</SelectItem>
                              <SelectItem value="likeCount">Likes</SelectItem>
                              <SelectItem value="commentCount">Comments</SelectItem>
                              <SelectItem value="shareCount">Shares</SelectItem>
                              <SelectItem value="saveCount">Saves</SelectItem>
                              <SelectItem value="publishedAt">Published Date</SelectItem>
                              <SelectItem value="authorHandle">Author</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {sorting.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Direction</h4>
                            <ToggleGroup
                              type="single"
                              value={sorting[0]?.desc ? 'desc' : 'asc'}
                              onValueChange={(value) => {
                                if (value && sorting[0]) {
                                  const newSorting: SortingState = [
                                    { id: sorting[0].id, desc: value === 'desc' }
                                  ]
                                  handleSortingChange(newSorting)
                                }
                              }}
                              className="w-full"
                            >
                              <ToggleGroupItem value="desc" className="flex-1 gap-1.5 h-8 text-xs">
                                <ArrowDown className="h-3 w-3" />
                                Descending
                              </ToggleGroupItem>
                              <ToggleGroupItem value="asc" className="flex-1 gap-1.5 h-8 text-xs">
                                <ArrowUp className="h-3 w-3" />
                                Ascending
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                        )}

                        {sorting.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleSortingChange([])
                            }}
                            className="w-full h-8 text-xs gap-1.5"
                          >
                            <X className="h-3 w-3" />
                            Reset Sorting
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  variant="outline"
                  onClick={handleCopyToClipboard}
                  disabled={selectedPosts.size === 0 || isCopyingToClipboard}
                  className="w-full sm:w-auto h-8 px-3 text-xs"
                >
                  <Clipboard className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsProjectSelectorOpen(true)}
                  disabled={selectedPosts.size === 0}
                  className="w-full sm:w-auto h-8 px-3 text-xs"
                >
                  <FolderPlus className="h-3 w-3" />
                  Add to Project {selectedPosts.size > 0 && ` (${selectedPosts.size})`}
                </Button>
                <Button
                  variant={isAnalysisSidebarOpen ? "default" : "outline"}
                  onClick={() => setIsAnalysisSidebarOpen(!isAnalysisSidebarOpen)}
                  className="w-full sm:w-auto h-8 px-3 text-xs"
                >
                  <MessageSquareIcon className="h-3 w-3" />
                  Chat{selectedPosts.size > 0 && ` (${selectedPosts.size})`}
                </Button>
              </div>
          }
        >
          {viewMode === 'metrics' ? (
            <>
              {/* Metrics and Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-4 px-4 pt-4">
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
                searchQuery={searchQuery}
                rowClassName={(row) => {
                  return 'bg-background'
                }}
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
              searchQuery={searchQuery}
                rowClassName={(row) => {
                  return 'bg-background'
                }}
            />
          )}
        </PageLayout>
      </div>

      {/* Project Selector Modal */}
      <ProjectSelectorModal
        isOpen={isProjectSelectorOpen}
        onClose={() => setIsProjectSelectorOpen(false)}
        onSelect={handleAddToProject}
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