'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { InlineEditableTitle } from '@/components/InlineEditableTitle'
import { InlineEditableText } from '@/components/InlineEditableText'

interface Concept {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  examples: Array<{ id: string; text: string }>
}

interface SplitProposal {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  exampleIds: string[]
  examples: Array<{ id: string; text: string }>
  confidence: number
  reasoning: string
}

interface SplitConceptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  concept: Concept | null
  onSplitComplete: () => void
}

const typeColors: Record<string, string> = {
  HOOK: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  CONTENT: 'bg-green-500/10 text-green-500 border-green-500/20',
  CTA: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
}

const confidenceColors = (confidence: number): string => {
  if (confidence >= 0.8) return 'bg-green-500/10 text-green-500 border-green-500/20'
  if (confidence >= 0.6) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
}

export function SplitConceptDialog({
  open,
  onOpenChange,
  concept,
  onSplitComplete
}: SplitConceptDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [splits, setSplits] = useState<SplitProposal[] | null>(null)
  const [editedSplits, setEditedSplits] = useState<Map<string, { title: string; coreMessage: string }>>(new Map())
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [canSplit, setCanSplit] = useState(true)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && concept) {
      // Start analysis automatically
      analyzeConcept()
    } else {
      // Reset state when closing
      setSplits(null)
      setEditedSplits(new Map())
      setExpandedSplits(new Set())
      setError(null)
      setCanSplit(true)
    }
  }, [open, concept?.id])

  const analyzeConcept = async () => {
    if (!concept) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch(`/api/concepts/${concept.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minimumExamplesPerSplit: 2,
          maxSplits: 5,
          executeImmediately: false
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze concept')
      }

      if (!data.canSplit) {
        setCanSplit(false)
        setError(data.message || 'This concept is already well-focused')
        setSplits([])
      } else {
        setCanSplit(true)
        setSplits(data.splits || [])
        // Expand all splits by default
        setExpandedSplits(new Set(data.splits.map((s: SplitProposal) => s.id)))
      }
    } catch (err) {
      console.error('Failed to analyze concept:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze concept')
      setCanSplit(false)
      setSplits([])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleExecuteSplit = async () => {
    if (!concept || !splits || splits.length === 0) return

    setIsExecuting(true)

    try {
      // Prepare splits with edited values
      const splitsToExecute = splits.map(split => {
        const edited = editedSplits.get(split.id)
        return {
          title: edited?.title || split.title,
          coreMessage: edited?.coreMessage || split.coreMessage,
          exampleIds: split.exampleIds
        }
      })

      const response = await fetch(`/api/concepts/${concept.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executeImmediately: true,
          splits: splitsToExecute,
          deleteOriginal: true // Always delete per plan
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to split concept')
      }

      toast.success(`Created ${data.conceptsCreated} new concepts`)
      onSplitComplete()
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to execute split:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to split concept')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleEditTitle = (splitId: string, newTitle: string) => {
    const split = splits?.find(s => s.id === splitId)
    if (!split) return

    const current = editedSplits.get(splitId) || { title: split.title, coreMessage: split.coreMessage }
    setEditedSplits(new Map(editedSplits).set(splitId, { ...current, title: newTitle }))
  }

  const handleEditCoreMessage = (splitId: string, newCoreMessage: string) => {
    const split = splits?.find(s => s.id === splitId)
    if (!split) return

    const current = editedSplits.get(splitId) || { title: split.title, coreMessage: split.coreMessage }
    setEditedSplits(new Map(editedSplits).set(splitId, { ...current, coreMessage: newCoreMessage }))
  }

  const toggleExpanded = (splitId: string) => {
    const newExpanded = new Set(expandedSplits)
    if (newExpanded.has(splitId)) {
      newExpanded.delete(splitId)
    } else {
      newExpanded.add(splitId)
    }
    setExpandedSplits(newExpanded)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (!concept) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Split Concept: {concept.title}</DialogTitle>
          <DialogDescription>
            AI will analyze examples and group them into more focused sub-concepts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Sparkles className="h-12 w-12 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Analyzing examples...</p>
            </div>
          )}

          {/* Error state */}
          {!isAnalyzing && error && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-orange-500" />
              <div className="text-center space-y-2">
                <p className="font-medium">Cannot Split Concept</p>
                <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              </div>
            </div>
          )}

          {/* Results view */}
          {!isAnalyzing && !error && splits && splits.length > 0 && (
            <div className="space-y-4">
              {splits.map((split, index) => {
                const edited = editedSplits.get(split.id)
                const isExpanded = expandedSplits.has(split.id)
                const currentTitle = edited?.title || split.title
                const currentCoreMessage = edited?.coreMessage || split.coreMessage

                return (
                  <div
                    key={split.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Split header */}
                    <div className="p-4 bg-muted/30 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Title */}
                          <div className="font-medium">
                            <InlineEditableTitle
                              value={currentTitle}
                              onSave={async (newValue) => {
                                handleEditTitle(split.id, newValue)
                              }}
                              placeholder="Enter title..."
                              className="font-medium text-base"
                            />
                          </div>

                          {/* Core Message */}
                          <div className="text-sm">
                            <InlineEditableText
                              value={currentCoreMessage}
                              onSave={async (newValue) => {
                                handleEditCoreMessage(split.id, newValue)
                              }}
                              placeholder="Enter core message..."
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge
                            variant="outline"
                            className={cn('text-xs', typeColors[split.type])}
                          >
                            {split.type}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', confidenceColors(split.confidence))}
                          >
                            {Math.round(split.confidence * 100)}%
                          </Badge>
                        </div>
                      </div>

                      {/* Expand/collapse button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(split.id)}
                        className="w-full justify-between h-8 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {split.examples.length} example{split.examples.length !== 1 ? 's' : ''}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Examples list (collapsible) */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-background">
                        {/* Reasoning */}
                        <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
                          {split.reasoning}
                        </div>

                        {/* Examples */}
                        <div className="space-y-2">
                          {split.examples.map((example, exIdx) => (
                            <div
                              key={example.id}
                              className="text-sm p-2 bg-muted/20 rounded border text-muted-foreground"
                            >
                              {example.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              Original concept will be deleted after split
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isExecuting}>
                Cancel
              </Button>
              <Button
                onClick={handleExecuteSplit}
                disabled={isAnalyzing || isExecuting || !canSplit || !splits || splits.length === 0}
              >
                {isExecuting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {splits?.length || 0} Concept{splits?.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
