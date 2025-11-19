'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Clipboard,
  FolderPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileText
} from 'lucide-react'
import { ProjectPostsTable, ProjectTableRow } from '@/components/ProjectPostsTable'
import { PageLayout } from '@/components/PageLayout'
import { toast } from 'sonner'
import { SortingState, RowSelectionState } from '@tanstack/react-table'
import { ProjectSelectorModal } from '@/components/ProjectSelectorModal'
import { SearchInput } from '@/components/SearchInput'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { RemixPost } from '@/types/remix'

interface DraftsResponse {
  drafts: (RemixPost & { _rowType: 'draft' })[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
  error?: string
}

function DraftsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10)

  // Parse sorting from URL
  const sortParam = searchParams.get('sort')
  let initialSorting: SortingState = []

  if (sortParam) {
    initialSorting = sortParam.split(',').map(sort => {
      const [id, direction] = sort.trim().split('.')
      return { id, desc: direction === 'desc' }
    })
  }

  // Parse search from URL
  const initialSearch = searchParams.get('search') || ''

  const [drafts, setDrafts] = useState<ProjectTableRow[]>([])
  const [totalDrafts, setTotalDrafts] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch)
  const [isSearching, setIsSearching] = useState(false)

  // Selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false)

  // Get selected draft IDs from row selection
  const selectedDraftIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key])
      .map(indexStr => {
        const index = parseInt(indexStr)
        return drafts[index]?.id
      })
      .filter(Boolean) as string[]
  }, [rowSelection, drafts])

  // Update URL with current state
  const updateURL = useCallback((page: number, sort: SortingState, search: string) => {
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

    if (search && search.trim().length > 0) {
      params.set('search', search.trim())
    }

    const queryString = params.toString()
    const newUrl = queryString ? `/drafts?${queryString}` : '/drafts'

    router.push(newUrl, { scroll: false })
  }, [router])

  const fetchDrafts = useCallback(async (page: number, limit: number, sort: SortingState, search: string): Promise<void> => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      // Add sorting parameters
      if (sort.length > 0) {
        const sortParam = sort
          .map(s => `${s.id}.${s.desc ? 'desc' : 'asc'}`)
          .join(',')
        params.append('sort', sortParam)
      }

      // Add search query
      if (search && search.trim().length > 0) {
        params.append('search', search.trim())
      }

      const response = await fetch(`/api/remixes/all?${params}`)
      const data: DraftsResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch drafts')
      }

      setDrafts(data.drafts || [])
      setTotalDrafts(data.pagination.totalCount || 0)
    } catch (error) {
      console.error('Failed to fetch drafts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch drafts')
      setDrafts([])
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

    setTimeout(() => {
      updateURL(currentPage, newSorting, searchQuery)
      fetchDrafts(currentPage, pageSize, newSorting, searchQuery)
    }, 0)
  }, [currentPage, pageSize, sorting, searchQuery, updateURL, fetchDrafts])

  // Handle page change with URL update
  const handlePageChange = useCallback((pageIndex: number, newPageSize: number) => {
    const newPage = pageIndex + 1
    setCurrentPage(newPage)
    setPageSize(newPageSize)

    setSorting(currentSorting => {
      updateURL(newPage, currentSorting, searchQuery)
      fetchDrafts(newPage, newPageSize, currentSorting, searchQuery)
      return currentSorting
    })
  }, [searchQuery, updateURL, fetchDrafts])

  // Handle search query change with URL update
  const handleSearchChange = useCallback((newSearch: string) => {
    setSearchQuery(newSearch)
    setCurrentPage(1)
    setIsSearching(true)

    setTimeout(() => {
      updateURL(1, sorting, newSearch)
      fetchDrafts(1, pageSize, sorting, newSearch).finally(() => {
        setIsSearching(false)
      })
    }, 0)
  }, [pageSize, sorting, updateURL, fetchDrafts])

  // Handle refetch
  const handleRefetchData = useCallback(() => {
    fetchDrafts(currentPage, pageSize, sorting, searchQuery)
  }, [currentPage, pageSize, sorting, searchQuery, fetchDrafts])

  // Handle draft removed
  const handleDraftRemoved = useCallback((draftId: string) => {
    // Refetch to update the list
    handleRefetchData()
  }, [handleRefetchData])

  // Sync state from URL params (for browser back/forward)
  useEffect(() => {
    const sortParam = searchParams.get('sort')
    const searchParam = searchParams.get('search') || ''

    let urlSorting: SortingState = []

    if (sortParam) {
      urlSorting = sortParam.split(',').map(sort => {
        const [id, direction] = sort.trim().split('.')
        return { id, desc: direction === 'desc' }
      })
    }

    const sortingDifferent = JSON.stringify(urlSorting) !== JSON.stringify(sorting)
    const searchDifferent = searchParam !== searchQuery

    if (sortingDifferent || searchDifferent) {
      if (sortingDifferent) setSorting(urlSorting)
      if (searchDifferent) setSearchQuery(searchParam)
      fetchDrafts(currentPage, pageSize, urlSorting, searchParam)
    }
  }, [searchParams])

  // Initial fetch
  useEffect(() => {
    fetchDrafts(initialPage, pageSize, initialSorting, initialSearch)
  }, [])

  const [isCopyingToClipboard, setIsCopyingToClipboard] = useState(false)

  const handleCopyToClipboard = useCallback(async () => {
    if (selectedDraftIds.length === 0) return

    setIsCopyingToClipboard(true)
    try {
      const selectedDrafts = drafts.filter(d => selectedDraftIds.includes(d.id)) as (RemixPost & { _rowType: 'draft' })[]

      const markdownContent = selectedDrafts.map((draft, index) => {
        const sections: string[] = []

        // Draft name as H1
        sections.push(`# ${draft.name}`)
        sections.push('')

        // Description
        if (draft.description) {
          sections.push('## Description')
          sections.push('')
          sections.push(draft.description)
          sections.push('')
        }

        // Slides
        if (draft.slides && draft.slides.length > 0) {
          sections.push('## Content')
          sections.push('')

          draft.slides.forEach((slide, slideIndex) => {
            const classification = draft.slideClassifications?.find(c => c.slideIndex === slideIndex)
            const slideType = classification?.type || 'unknown'

            sections.push(`### Slide ${slideIndex + 1} - ${slideType}`)
            sections.push('')
            sections.push(slide.paraphrasedText || '')
            sections.push('')
          })
        }

        return sections.join('\n')
      }).join('\n---\n\n')

      await navigator.clipboard.writeText(markdownContent)

      toast.success(`Copied ${selectedDraftIds.length} draft${selectedDraftIds.length !== 1 ? 's' : ''} to clipboard`, {
        description: 'Content is ready to paste'
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard', {
        description: 'Please try again'
      })
    } finally {
      setIsCopyingToClipboard(false)
    }
  }, [selectedDraftIds, drafts])

  const handleAddToProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: selectedDraftIds })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add drafts to project')
      }

      toast.success(data.message || `Added ${selectedDraftIds.length} draft${selectedDraftIds.length !== 1 ? 's' : ''} to project`, {
        description: 'View project to see them',
        action: {
          label: 'View Project',
          onClick: () => router.push(`/projects/${projectId}`)
        }
      })

      // Clear selection after successful add
      setRowSelection({})
    } catch (error) {
      console.error('Failed to add drafts to project:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add drafts to project')
    }
  }

  return (
    <div className="flex h-screen w-full min-w-0">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PageLayout
          title={
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span>All Drafts</span>
              <SearchInput
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search drafts..."
                isLoading={isSearching}
              />
            </div>
          }
          headerActions={
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 px-3 text-xs"
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
                          <SelectItem value="updatedAt">Updated Date</SelectItem>
                          <SelectItem value="createdAt">Created Date</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="bookmarked">Bookmarked</SelectItem>
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
              <Button
                variant="outline"
                onClick={handleCopyToClipboard}
                disabled={selectedDraftIds.length === 0 || isCopyingToClipboard}
                className="w-8 h-8 px-3 text-xs"
                size="icon"
              >
                <Clipboard className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsProjectSelectorOpen(true)}
                disabled={selectedDraftIds.length === 0}
                className="h-8 w-8 text-xs"
                size="icon"
              >
                <FolderPlus className="h-3 w-3" />
              </Button>
            </div>
          }
        >
          {/* Drafts Table */}
          <ProjectPostsTable
            rows={drafts}
            totalRows={totalDrafts}
            onPageChange={handlePageChange}
            onSortingChange={handleSortingChange}
            onRefetchData={handleRefetchData}
            sorting={sorting}
            enableServerSideSorting={true}
            isLoading={isLoading}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            viewMode="content"
            searchQuery={searchQuery}
            onDraftRemoved={handleDraftRemoved}
            rowClassName={(row) => {
              return 'bg-background'
            }}
          />
        </PageLayout>
      </div>

      {/* Project Selector Modal */}
      <ProjectSelectorModal
        isOpen={isProjectSelectorOpen}
        onClose={() => setIsProjectSelectorOpen(false)}
        onSelect={handleAddToProject}
      />
    </div>
  )
}

export default function DraftsPage() {
  return (
    <Suspense fallback={
      <PageLayout title="All Drafts" description="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    }>
      <DraftsPageContent />
    </Suspense>
  )
}
