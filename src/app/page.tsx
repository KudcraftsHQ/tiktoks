'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SearchBar from '@/components/SearchBar'
import CarouselCard from '@/components/CarouselCard'
import InfiniteScroll from '@/components/InfiniteScroll'
import FilterPanel, { FilterState } from '@/components/FilterPanel'
import { Carousel as CarouselType } from '@/generated/prisma'

interface CarouselResponse {
  carousels: (CarouselType & {
    images: Array<{
      id: string
      imageUrl: string
      text?: string | null
    }>
  })[]
  hasMore: boolean
  total: number
}

export default function Home() {
  const router = useRouter()
  const [carousels, setCarousels] = useState<CarouselResponse['carousels']>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [isAddingCarousel, setIsAddingCarousel] = useState(false)
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([])
  const [isLoadingAuthors, setIsLoadingAuthors] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    authors: [],
    dateRange: 'all',
    imageCount: {},
    sortBy: 'newest'
  })

  const fetchCarousels = async (pageNum: number, query: string = '', currentFilters: FilterState = filters) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '5',
        ...(query && { search: query }),
        ...(currentFilters.authors.length > 0 && { authors: currentFilters.authors.join(',') }),
        ...(currentFilters.dateRange !== 'all' && { dateRange: currentFilters.dateRange }),
        ...(currentFilters.customDateStart && { customDateStart: currentFilters.customDateStart.toISOString().split('T')[0] }),
        ...(currentFilters.customDateEnd && { customDateEnd: currentFilters.customDateEnd.toISOString().split('T')[0] }),
        ...(currentFilters.imageCount.min && { imageCountMin: currentFilters.imageCount.min.toString() }),
        ...(currentFilters.imageCount.max && { imageCountMax: currentFilters.imageCount.max.toString() }),
        ...(currentFilters.sortBy !== 'newest' && { sortBy: currentFilters.sortBy })
      })
      
      const response = await fetch(`/api/carousels?${params}`)
      const data: CarouselResponse = await response.json()
      
      if (pageNum === 1) {
        setCarousels(data.carousels)
      } else {
        setCarousels(prev => [...prev, ...data.carousels])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Failed to fetch carousels:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAuthors = async () => {
    setIsLoadingAuthors(true)
    try {
      const response = await fetch('/api/authors')
      const authors = await response.json()
      setAvailableAuthors(authors.map((author: any) => author.name))
    } catch (error) {
      console.error('Failed to fetch authors:', error)
    } finally {
      setIsLoadingAuthors(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
    fetchCarousels(1, query, filters)
  }

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setPage(1)
    fetchCarousels(1, searchQuery, newFilters)
  }

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchCarousels(nextPage, searchQuery, filters)
    }
  }

  const handleAddCarousel = async (url: string) => {
    setIsAddingCarousel(true)
    try {
      const response = await fetch('/api/carousels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (response.ok) {
        setPage(1)
        fetchCarousels(1, searchQuery, filters)
        fetchAuthors() // Refresh authors list
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to add carousel')
      }
    } catch (error) {
      console.error('Failed to add carousel:', error)
      alert('Failed to add carousel')
    } finally {
      setIsAddingCarousel(false)
    }
  }

  useEffect(() => {
    fetchCarousels(1)
    fetchAuthors()
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
        {/* Secondary Sidebar - Search and Filter */}
        <div className="w-80 border-r bg-card/50 p-4 flex flex-col h-screen">
          <div className="space-y-6">
            <SearchBar 
              onSearch={handleSearch}
              placeholder="Search carousels..."
              className="w-full"
            />
            
            <FilterPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              availableAuthors={availableAuthors}
              isLoading={isLoadingAuthors}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 h-screen overflow-auto">

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
          <InfiniteScroll
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={handleLoadMore}
          >
            {carousels.length > 0 ? (
              <div className="space-y-3">
                {carousels.map((carousel) => (
                  <div key={carousel.id} className="block md:hidden">
                    <CarouselCard
                      carousel={carousel}
                      isMobile={true}
                      onClick={() => {
                        router.push(`/carousel/${carousel.id}`)
                      }}
                    />
                  </div>
                ))}
                {carousels.map((carousel) => (
                  <div key={`desktop-${carousel.id}`} className="hidden md:block">
                    <CarouselCard
                      carousel={carousel}
                      isMobile={false}
                      onClick={() => {
                        router.push(`/carousel/${carousel.id}`)
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-muted-foreground">
                  {searchQuery ? (
                    <p>No carousels found matching your search.</p>
                  ) : (
                    <p>No carousels yet. Add your first TikTok carousel to get started!</p>
                  )}
                </div>
              </div>
            )}
          </InfiniteScroll>
          </main>
        </div>
      </div>
  )
}
