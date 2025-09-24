'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronDown, Loader2 } from 'lucide-react'

interface LoadMoreButtonProps {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  tooltip?: string
}

export function LoadMoreButton({
  onClick,
  loading = false,
  disabled = false,
  tooltip
}: LoadMoreButtonProps) {
  const button = (
    <Button
      onClick={onClick}
      disabled={loading || disabled}
      variant="outline"
      size="lg"
      className="min-w-[140px]"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <ChevronDown className="w-4 h-4 mr-2" />
          Load More
        </>
      )}
    </Button>
  )

  if (tooltip && disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}