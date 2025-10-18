'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Filter } from 'lucide-react'
import AuthorFilter from './AuthorFilter'
import { DateRangeFilter, type DateRange } from './DateRangeFilter'
import ImageCountFilter from './ImageCountFilter'
import SortControls from './SortControls'

export interface FilterState {
  authors: string[]
  dateRange: DateRange
  imageCount: {
    min?: number
    max?: number
  }
  sortBy: 'newest' | 'oldest' | 'author-az' | 'author-za' | 'most-images' | 'least-images'
}

interface FilterPanelProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  availableAuthors: string[]
  isLoading?: boolean
}

export default function FilterPanel({ 
  filters, 
  onFiltersChange, 
  availableAuthors,
  isLoading = false 
}: FilterPanelProps) {

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.authors.length > 0) count++
    if (filters.dateRange.from || filters.dateRange.to) count++
    if (filters.imageCount.min || filters.imageCount.max) count++
    if (filters.sortBy !== 'newest') count++
    return count
  }

  const clearAllFilters = () => {
    onFiltersChange({
      authors: [],
      dateRange: { from: undefined, to: undefined },
      imageCount: {},
      sortBy: 'newest'
    })
  }

  const activeFilterCount = getActiveFilterCount()

  return (
    <div>
      {/* Filter Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="h-8"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Filter Controls - Always visible in sidebar */}
      <div className="space-y-6">
        {/* Sort Controls */}
        <div>
          <SortControls
            value={filters.sortBy}
            onChange={(sortBy) => onFiltersChange({ ...filters, sortBy })}
          />
        </div>
        
        {/* Date Range Filter */}
        <div>
          <DateRangeFilter
            value={filters.dateRange}
            onChange={(dateRange) =>
              onFiltersChange({
                ...filters,
                dateRange
              })
            }
          />
        </div>

        {/* Author Filter */}
        <div>
          <AuthorFilter
            selectedAuthors={filters.authors}
            availableAuthors={availableAuthors}
            onChange={(authors) => onFiltersChange({ ...filters, authors })}
            isLoading={isLoading}
          />
        </div>
        
        {/* Image Count Filter */}
        <div>
          <ImageCountFilter
            value={filters.imageCount}
            onChange={(imageCount) => onFiltersChange({ ...filters, imageCount })}
          />
        </div>
      </div>
    </div>
  )
}