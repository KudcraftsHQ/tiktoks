'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'

interface ConceptTypeDropdownProps {
  conceptId: string
  currentType: 'HOOK' | 'CONTENT' | 'CTA'
  onUpdate: (newType: string) => Promise<void>
}

export function ConceptTypeDropdown({
  conceptId,
  currentType: initialType,
  onUpdate
}: ConceptTypeDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [optimisticType, setOptimisticType] = useState<'HOOK' | 'CONTENT' | 'CTA'>(initialType)

  // Use optimistic type if available, otherwise fall back to initial type
  const displayType = optimisticType ?? initialType

  const handleTypeChange = async (newType: 'HOOK' | 'CONTENT' | 'CTA') => {
    if (newType === displayType) return

    // Optimistically update the UI
    setOptimisticType(newType)
    setIsUpdating(true)

    try {
      await onUpdate(newType)
    } catch (error) {
      // Revert on error
      setOptimisticType(initialType)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={isUpdating} className="cursor-pointer">
        <SlideClassificationBadge type={displayType} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => handleTypeChange('HOOK')}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlideClassificationBadge type="HOOK" />
            <span className="text-xs text-muted-foreground">
              (Attention grabber)
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleTypeChange('CONTENT')}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlideClassificationBadge type="CONTENT" />
            <span className="text-xs text-muted-foreground">
              (Main message)
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleTypeChange('CTA')}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlideClassificationBadge type="CTA" />
            <span className="text-xs text-muted-foreground">
              (Call to action)
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
