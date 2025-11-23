'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Concept {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
}

interface MoveToConceptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  concepts: Concept[]
  selectedCount: number
  excludeConceptIds: string[]
  onConfirm: (targetConceptId: string) => Promise<void>
}

const typeColors: Record<string, string> = {
  HOOK: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  CONTENT: 'bg-green-500/10 text-green-500 border-green-500/20',
  CTA: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
}

export function MoveToConceptDialog({
  open,
  onOpenChange,
  concepts,
  selectedCount,
  excludeConceptIds,
  onConfirm
}: MoveToConceptDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Filter concepts by search and exclude current concepts
  const filteredConcepts = useMemo(() => {
    return concepts
      .filter(c => !excludeConceptIds.includes(c.id))
      .filter(c => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
          c.title.toLowerCase().includes(searchLower) ||
          c.coreMessage.toLowerCase().includes(searchLower)
        )
      })
  }, [concepts, excludeConceptIds, search])

  const handleConfirm = async () => {
    if (!selectedConceptId) return

    setIsLoading(true)
    try {
      await onConfirm(selectedConceptId)
      onOpenChange(false)
      setSelectedConceptId(null)
      setSearch('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setSelectedConceptId(null)
    setSearch('')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move to Existing Concept</DialogTitle>
          <DialogDescription>
            Move {selectedCount} example{selectedCount > 1 ? 's' : ''} to another concept.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search concepts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Concept list */}
        <div className="max-h-[300px] overflow-y-auto border rounded-lg">
          {filteredConcepts.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No concepts found
            </div>
          ) : (
            <div className="divide-y">
              {filteredConcepts.map(concept => (
                <div
                  key={concept.id}
                  className={cn(
                    'p-3 cursor-pointer transition-colors hover:bg-muted/50',
                    selectedConceptId === concept.id && 'bg-primary/10 hover:bg-primary/10'
                  )}
                  onClick={() => setSelectedConceptId(concept.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {concept.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0', typeColors[concept.type])}
                        >
                          {concept.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {concept.coreMessage}
                      </p>
                    </div>
                    {selectedConceptId === concept.id && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedConceptId || isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Move {selectedCount} Example{selectedCount > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
