'use client'

import { Button } from '@/components/ui/button'
import { X, FolderInput, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingSelectionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onMoveToExisting: () => void
  onMoveToNew: () => void
}

export function FloatingSelectionBar({
  selectedCount,
  onClearSelection,
  onMoveToExisting,
  onMoveToNew
}: FloatingSelectionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 bg-background border border-border rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.15),0_0_40px_rgba(255,255,255,0.1)] px-4 py-3">
        {/* Selection count */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} example{selectedCount > 1 ? 's' : ''} selected
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onMoveToExisting}
            className="h-8"
          >
            <FolderInput className="h-4 w-4 mr-2" />
            Move to Concept
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onMoveToNew}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Concept
          </Button>
        </div>
      </div>
    </div>
  )
}
