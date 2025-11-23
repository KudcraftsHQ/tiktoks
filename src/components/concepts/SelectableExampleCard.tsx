'use client'

import { Textarea } from '@/components/ui/textarea'
import { Eye, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SourcePost {
  id: string
  viewCount: number | null
  images: any
}

export interface ExampleData {
  id: string
  text: string
  sourceType: string
  sourcePostId: string | null
  sourceSlideIndex: number | null
  createdAt: string
  sourcePost?: SourcePost | null
}

interface SelectableExampleCardProps {
  example: ExampleData
  conceptId: string
  isSelected: boolean
  onSelect: (exampleId: string, multiSelect: boolean) => void
  onDelete: (exampleId: string) => void
  onSlideClick: (example: ExampleData) => void
  formatViewCount: (count: number | null | undefined) => string
}

export function SelectableExampleCard({
  example,
  conceptId,
  isSelected,
  onSelect,
  onDelete,
  onSlideClick,
  formatViewCount
}: SelectableExampleCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(example.id, e.metaKey || e.ctrlKey)
  }

  return (
    <div
      className="flex-shrink-0 w-52 flex flex-col"
    >
      {/* Example header */}
      <div className="flex items-center justify-between mb-2 h-5">
        <div className="flex items-center gap-1.5">
          {/* Selection checkbox */}
          <div
            className={cn(
              'w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all flex-shrink-0',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted border border-muted-foreground/30'
            )}
            onClick={handleClick}
          >
            {isSelected && <Check className="h-2.5 w-2.5" />}
          </div>
          <Eye className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground">
            {formatViewCount(example.sourcePost?.viewCount)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {example.sourcePostId && example.sourceSlideIndex !== null && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSlideClick(example)
              }}
              className="text-[10px] text-primary hover:underline cursor-pointer"
            >
              Slide {(example.sourceSlideIndex ?? 0) + 1}
            </button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(example.id)
                }}
                className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Delete example</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Example text */}
      <div
        className="h-32 overflow-y-auto cursor-pointer"
        onClick={handleClick}
      >
        <Textarea
          value={example.text}
          readOnly
          className={cn(
            'h-full resize-none text-[12px] leading-tight whitespace-pre-wrap break-words overflow-y-auto bg-muted/30 cursor-pointer pointer-events-none border',
            isSelected ? 'border-white/50 bg-muted/50' : 'border-transparent'
          )}
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        />
      </div>
    </div>
  )
}
