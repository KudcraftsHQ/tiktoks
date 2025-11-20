'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RemixSlideTypeDropdownProps {
  remixId: string
  slideIndex: number
  currentType: 'hook' | 'content' | 'cta' | null
  onUpdate?: () => void
}

export function RemixSlideTypeDropdown({
  remixId,
  slideIndex,
  currentType: initialType,
  onUpdate
}: RemixSlideTypeDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [optimisticType, setOptimisticType] = useState<'hook' | 'content' | 'cta' | null>(initialType)

  // Use optimistic type if available, otherwise fall back to initial type
  const displayType = optimisticType ?? initialType

  const handleTypeChange = async (newType: 'hook' | 'content' | 'cta') => {
    if (newType === displayType) return

    // Optimistically update the UI
    setOptimisticType(newType)
    setIsUpdating(true)

    try {
      const response = await fetch(
        `/api/remixes/${remixId}/slides/${slideIndex}/classification`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ slideType: newType }),
        }
      )

      if (!response.ok) {
        // Revert on error
        setOptimisticType(initialType)
        throw new Error('Failed to update classification')
      }

      toast.success(`Slide ${slideIndex + 1} classified as ${newType}`)

      // Don't trigger refetch - optimistic update is sufficient
      // The parent component will naturally refresh on next data fetch
    } catch (error) {
      console.error('Failed to update classification:', error)
      toast.error('Could not update slide classification')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={isUpdating} className="cursor-pointer">
        <SlideClassificationBadge type={displayType ? (displayType.toUpperCase() as 'HOOK' | 'CONTENT' | 'CTA') : null} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => handleTypeChange('hook')}
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
          onClick={() => handleTypeChange('content')}
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
          onClick={() => handleTypeChange('cta')}
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
