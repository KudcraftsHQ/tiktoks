'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Palette, 
  Copy, 
  RotateCcw, 
  Trash2, 
  Sparkles,
  User,
  Bot
} from 'lucide-react'

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
  backgroundImageUrl?: string | null
  displayOrder: number
  textBoxes: CarouselTextBox[]
}

interface CarouselVariation {
  id: string
  name: string
  description?: string | null
  isOriginal: boolean
  generationType?: string | null
  createdAt: Date
  slides: CarouselSlide[]
}

interface CarouselVariationCardProps {
  variation: CarouselVariation
  onDesign: (variationId: string) => void
  onDuplicate: (variationId: string) => void
  onRephrase: (variationId: string) => void
  onDelete: (variationId: string) => void
}

export function CarouselVariationCard({
  variation,
  onDesign,
  onDuplicate, 
  onRephrase,
  onDelete
}: CarouselVariationCardProps) {
  const getVariationIcon = () => {
    switch (variation.generationType) {
      case 'ai_rephrase':
        return <Bot className="h-4 w-4" />
      case 'duplicate':
        return <Copy className="h-4 w-4" />
      case 'manual':
        return <User className="h-4 w-4" />
      default:
        return variation.isOriginal ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />
    }
  }

  const getVariationLabel = () => {
    if (variation.isOriginal) return 'Original'
    switch (variation.generationType) {
      case 'ai_rephrase':
        return 'AI Generated'
      case 'duplicate':
        return 'Manual Copy'
      case 'manual':
        return 'Manual'
      default:
        return 'Custom'
    }
  }

  return (
    <div className="w-full mb-6">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        {/* Left side: Icon, Title, Badge */}
        <div className="flex gap-3 flex-1 min-w-0 items-center">
          {/* Icon Thumbnail */}
          <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-full overflow-hidden flex items-center justify-center">
            {getVariationIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Title and Badge */}
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base cursor-pointer hover:text-primary transition-colors">
                {variation.name}
              </h3>
              <Badge variant="outline" className="text-xs">
                {getVariationLabel()}
              </Badge>
            </div>
            {variation.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {variation.description}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            onClick={() => onDesign(variation.id)}
            size="sm"
            className="h-8 px-3"
          >
            <Palette className="h-4 w-4 mr-1" />
            Design
          </Button>
          <Button
            onClick={() => onDuplicate(variation.id)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => onRephrase(variation.id)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {!variation.isOriginal && (
            <Button
              onClick={() => onDelete(variation.id)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Carousel Images Row */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-4">
          {variation.slides
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((slide, index) => (
              <div
                key={slide.id}
                className="flex flex-col gap-3 flex-shrink-0 w-60"
              >
                <div className="relative flex bg-muted rounded-sm overflow-hidden cursor-pointer aspect-[9/15] items-center w-full h-auto group">
                  {slide.backgroundImageUrl ? (
                    <img
                      src={slide.backgroundImageUrl}
                      alt={`Slide ${index + 1}`}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-sm text-gray-400 font-medium">
                        {index + 1}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {index + 1}
                  </div>
                </div>
                <div className="w-60 relative">
                  <Textarea
                    placeholder={`Text for slide ${index + 1}...`}
                    value={slide.textBoxes.map(tb => tb.text).join('\n') || ''}
                    className="h-[200px] resize-none text-sm w-full"
                    rows={3}
                    readOnly
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}