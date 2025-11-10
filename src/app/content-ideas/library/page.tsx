'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'
import { PageLayout } from '@/components/PageLayout'
import {
  ArrowLeft,
  Search,
  Loader2,
  Library,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SlideData {
  id: string
  slideIndex: number
  type: string
  contentText: string
  languageStyleTags: string[]
  createdAt: string
  category: {
    id: string
    name: string
    type: string
  }
  remixPost: {
    id: string
    name: string
    sourcePostIds: string[]
  }
}

interface Category {
  id: string
  name: string
  type: string
  slideCount: number
}

export default function ContentLibraryPage() {
  const router = useRouter()
  const [slides, setSlides] = useState<SlideData[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    fetchCategories()
    fetchSlides()
  }, [typeFilter, categoryFilter])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/content-ideas/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')

      const data = await response.json()
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchSlides = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '100'
      })

      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }

      if (categoryFilter !== 'all') {
        params.append('categoryId', categoryFilter)
      }

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/content-ideas/library?${params}`)
      if (!response.ok) throw new Error('Failed to fetch library')

      const data = await response.json()
      setSlides(data.slides || [])
    } catch (error) {
      console.error('Failed to fetch library:', error)
      toast.error('Failed to load library')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCategories = categories.filter(c =>
    typeFilter === 'all' || c.type === typeFilter
  )

  return (
    <PageLayout
      title="Content Library"
      description="Browse and search classified slides"
      headerActions={
        <Button onClick={() => router.push('/')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Posts
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search slides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchSlides()}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="HOOK">Hooks</SelectItem>
            <SelectItem value="CONTENT">Content</SelectItem>
            <SelectItem value="CTA">CTAs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {filteredCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name} ({cat.slideCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={fetchSlides}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : slides.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Library className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="font-medium mb-2">No slides found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or process some posts first
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="rounded-lg border p-4 space-y-3 hover:shadow-md transition-shadow"
            >
              {/* Badge and Tags */}
              <div className="flex items-start justify-between gap-2">
                <SlideClassificationBadge
                  type={slide.type as any}
                  categoryName={slide.category.name}
                />
                {slide.languageStyleTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {slide.languageStyleTags.slice(0, 2).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <p className="text-sm leading-relaxed">
                {slide.contentText}
              </p>

              {/* Metadata */}
              <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
                <p>From: {slide.remixPost.name}</p>
                {slide.remixPost.sourcePostIds.length > 0 && (
                  <p>{slide.remixPost.sourcePostIds.length} source{slide.remixPost.sourcePostIds.length !== 1 ? 's' : ''}</p>
                )}
                <p>{new Date(slide.createdAt).toLocaleDateString()}</p>
              </div>

              {/* Action */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push(`/remix/${slide.remixPost.id}/edit`)}
              >
                View Remix
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Results Count */}
      {!isLoading && slides.length > 0 && (
        <div className="mt-6 text-sm text-muted-foreground text-center">
          Showing {slides.length} slide{slides.length !== 1 ? 's' : ''}
        </div>
      )}
    </PageLayout>
  )
}
