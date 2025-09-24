'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutGrid, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import InfiniteScroll from '@/components/InfiniteScroll'

interface CarouselTextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  color: string
  textAlign: string
  zIndex: number
}

interface CarouselSlide {
  id: string
  variationId: string
  backgroundImageUrl?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
  displayOrder: number
  createdAt: Date
  textBoxes: CarouselTextBox[]
  variation: {
    id: string
    name: string
    description?: string | null
    carousel: {
      id: string
      title?: string | null
      author?: string | null
      authorHandle?: string | null
    }
  }
}

interface SlidesResponse {
  slides: CarouselSlide[]
  hasMore: boolean
  total: number
  page: number
  limit: number
}

export default function AllSlidesPage() {
  const router = useRouter()
  const [slides, setSlides] = useState<CarouselSlide[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const fetchSlides = async (pageNum: number, query: string = '') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '24',
        ...(query && { search: query })
      })
      
      const response = await fetch(`/api/slides?${params}`)
      const data: SlidesResponse = await response.json()
      
      if (pageNum === 1) {
        setSlides(data.slides)
      } else {
        setSlides(prev => [...prev, ...data.slides])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Failed to fetch slides:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
    fetchSlides(1, query)
  }

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchSlides(nextPage, searchQuery)
    }
  }

  const handleSlideClick = (slide: CarouselSlide) => {
    router.push(`/carousel/${slide.variation.carousel.id}/edit/${slide.variationId}`)
  }

  useEffect(() => {
    fetchSlides(1)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
        {/* Main Content Area */}
        <div className="flex-1">
          {/* Header */}
          <div className="border-b bg-card/50 sticky top-0 z-10">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LayoutGrid className="h-6 w-6" />
                  <h1 className="text-2xl font-bold">All Slides</h1>
                  <Badge variant="outline">
                    {slides.length} slide{slides.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {/* Search */}
                <div className="relative w-96">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search slides..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Slides Grid */}
          <div className="container mx-auto px-4 py-6">
            <InfiniteScroll
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={handleLoadMore}
            >
              {slides.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {slides.map((slide) => (
                    <Card 
                      key={slide.id} 
                      className="group cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden"
                      onClick={() => handleSlideClick(slide)}
                    >
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium line-clamp-2 mb-1">
                              {slide.variation.name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {slide.variation.carousel.author || 'Unknown Author'}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-3 pt-0">
                        {/* Slide Thumbnail */}
                        <div className="relative aspect-[9/16] bg-muted rounded-md overflow-hidden mb-2">
                          {slide.backgroundImageUrl ? (
                            <img
                              src={slide.backgroundImageUrl}
                              alt="Slide preview"
                              className="w-full h-full object-cover"
                              style={{
                                objectPosition: `${slide.backgroundImagePositionX * 100}% ${slide.backgroundImagePositionY * 100}%`,
                                transform: `scale(${slide.backgroundImageZoom})`
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                              <LayoutGrid className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          
                          {/* Text overlay preview */}
                          {slide.textBoxes.length > 0 && (
                            <div className="absolute inset-0 pointer-events-none">
                              {slide.textBoxes.slice(0, 2).map((textBox) => {
                                const thumbnailFontSize = Math.max(6, Math.min(12, textBox.fontSize * 0.15))
                                const isLightText = textBox.color === '#ffffff' || textBox.color === '#fff' || textBox.color.toLowerCase() === 'white'
                                
                                return (
                                  <div
                                    key={textBox.id}
                                    className="absolute font-medium leading-tight overflow-hidden flex items-center justify-center"
                                    style={{
                                      left: `${textBox.x * 100}%`,
                                      top: `${textBox.y * 100}%`,
                                      width: `${textBox.width * 100}%`,
                                      height: `${textBox.height * 100}%`,
                                      color: textBox.color,
                                      fontWeight: textBox.fontWeight === 'bold' ? '700' : '500',
                                      fontSize: `${thumbnailFontSize}px`,
                                      textAlign: textBox.textAlign as any,
                                      textShadow: isLightText ? '0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)' : '0 0 2px rgba(255,255,255,0.8)',
                                    }}
                                  >
                                    <span className="block max-w-full line-clamp-3 text-center">
                                      {textBox.text}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to edit
                            </div>
                          </div>
                        </div>
                        
                        {/* Metadata */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Slide {slide.displayOrder + 1}</span>
                            <span>{slide.textBoxes.length} text{slide.textBoxes.length !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {slide.variation.carousel.title || 'Untitled Carousel'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="text-muted-foreground">
                    {searchQuery ? (
                      <p>No slides found matching your search.</p>
                    ) : (
                      <p>No slides created yet. Start by creating a carousel variation!</p>
                    )}
                  </div>
                </div>
              )}
            </InfiniteScroll>
          </div>
        </div>
      </div>
  )
}