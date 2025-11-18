'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import type { RemixSlideType } from '@/lib/validations/remix-schema'

interface SlideCardProps {
  slide: RemixSlideType
  slideIndex: number
  slideType: 'Hook' | 'Content' | 'CTA'
  onTextChange: (newText: string) => void
  onEditClick: () => void
  className?: string
}

export function SlideCard({
  slide,
  slideIndex,
  slideType,
  onTextChange,
  onEditClick,
  className = ''
}: SlideCardProps) {
  const [text, setText] = useState(slide.paraphrasedText || '')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update local state when slide changes externally
  useEffect(() => {
    if (!isFocused) {
      setText(slide.paraphrasedText || '')
    }
  }, [slide.paraphrasedText, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    onTextChange(newText)
  }

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' => {
    if (slideType === 'Hook') return 'default'
    if (slideType === 'CTA') return 'destructive'
    return 'secondary'
  }

  return (
    <div className={`border rounded-lg p-3 space-y-2 bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge variant={getBadgeVariant()} className="text-xs">
          Slide {slideIndex + 1} - {slideType}
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={onEditClick}
          className="h-7 w-7 p-0 hover:bg-accent"
          title="Edit slide layout"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>

      {/* Editable text area */}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={`Add ${slideType.toLowerCase()} content...`}
        className="min-h-[100px] text-sm resize-none focus:ring-1 focus:ring-primary"
        rows={4}
      />

      {/* Character count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{text.length} characters</span>
        {slide.textBoxes && slide.textBoxes.length > 0 && (
          <span>{slide.textBoxes.length} text box{slide.textBoxes.length !== 1 ? 'es' : ''}</span>
        )}
      </div>
    </div>
  )
}
