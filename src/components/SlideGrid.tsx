'use client'

import { SlideCard } from './SlideCard'
import { Button } from './ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { RemixSlideType } from '@/lib/validations/remix-schema'

interface SlideGridProps {
  slides: RemixSlideType[]
  isExpanded: boolean
  onToggleExpand: () => void
  onSlideTextChange: (slideIndex: number, newText: string) => void
  onSlideEditClick: (slideIndex: number) => void
  className?: string
}

// Helper to determine slide type
function getSlideType(index: number, total: number): 'Hook' | 'Content' | 'CTA' {
  if (index === 0) return 'Hook'
  if (index === total - 1 && total > 2) return 'CTA'
  return 'Content'
}

export function SlideGrid({
  slides,
  isExpanded,
  onToggleExpand,
  onSlideTextChange,
  onSlideEditClick,
  className = ''
}: SlideGridProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with expand/collapse */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {slides.length} slide{slides.length !== 1 ? 's' : ''}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="h-7 text-xs gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Expand
            </>
          )}
        </Button>
      </div>

      {/* Grid of slides (only shown when expanded) */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {slides.map((slide, index) => (
            <SlideCard
              key={slide.id}
              slide={slide}
              slideIndex={index}
              slideType={getSlideType(index, slides.length)}
              onTextChange={(newText) => onSlideTextChange(index, newText)}
              onEditClick={() => onSlideEditClick(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
