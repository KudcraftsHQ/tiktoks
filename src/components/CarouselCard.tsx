'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, User, Images, ExternalLink, Heart, Share, MoreHorizontal } from 'lucide-react'
import { Carousel as CarouselType } from '@/generated/prisma'

interface CarouselCardProps {
  carousel: CarouselType & {
    images: Array<{
      id: string
      imageUrl: string
      text?: string | null
    }>
  }
  onClick?: () => void
  isMobile?: boolean
}

export default function CarouselCard({ carousel, onClick, isMobile = false }: CarouselCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date))
  }

  const hasText = carousel.images.some(img => img.text)
  const previewImage = carousel.images[0]

  const handleActionClick = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    console.log(`${action} clicked for carousel:`, carousel.id)
    // Handle action logic here
  }

  return (
    <div className={`transition-all duration-200 ${isMobile ? 'w-full mb-4' : 'w-full mb-6'
      }`}>
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          {/* Left side: Thumbnail, Title, Tags, Metadata */}
          <div className="flex gap-3 flex-1 min-w-0 items-center">
            {/* Thumbnail */}
            {previewImage && (
              <div
                className="flex-shrink-0 w-12 h-12 bg-muted rounded-full overflow-hidden cursor-pointer"
                onClick={onClick}
              >
                <img
                  src={previewImage.imageUrl}
                  alt={carousel.title || 'Carousel preview'}
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Title */}
              <CardTitle
                className={`font-semibold line-clamp-2 cursor-pointer hover:text-primary transition-colors ${isMobile ? 'text-sm' : 'text-base'
                  }`}
                onClick={onClick}
              >
                {carousel.author}
              </CardTitle>
            </div>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => handleActionClick(e, 'favorite')}
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => handleActionClick(e, 'share')}
            >
              <Share className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => window.open(carousel.tiktokUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => handleActionClick(e, 'more')}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Carousel Images Row */}
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-2">
            {carousel.images.map((image, index) => (
              <div
                key={image.id}
                className={`relative flex-shrink-0 bg-muted rounded-sm overflow-hidden cursor-pointer aspect-[9/15] items-center ${isMobile ? 'h-32 w-[72px]' : 'h-[430px] w-[240px]'
                  }`}
                onClick={onClick}
              >
                <img
                  src={image.imageUrl}
                  alt={`Image ${index + 1}`}
                  className="w-full h-auto"
                />
              </div>
            ))}
          </div>
        </div>
    </div>
  )
}