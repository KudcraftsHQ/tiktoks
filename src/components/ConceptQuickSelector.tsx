'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Loader2, ChevronRight, ChevronDown, Lightbulb, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ConceptExample {
  id: string
  text: string
  sourceType: string
  sourcePostId: string | null
  sourcePost?: {
    viewCount: number | null
  } | null
}

interface Concept {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  examples: ConceptExample[]
}

interface ConceptQuickSelectorProps {
  slideType: 'HOOK' | 'CONTENT' | 'CTA' | null
  slideIndex: number
  onApply: (
    text: string,
    conceptId: string,
    conceptTitle: string,
    exampleId: string,
    exampleIds: string[]
  ) => Promise<void>
  // For auto-fill on HOOK selection
  onAutoFill?: () => Promise<void>
  // For cycling - current state from parent
  currentConceptId?: string | null
  currentExampleIndex?: number
  currentExampleIds?: string[]
  onCycle?: () => void
  isApplying?: boolean
}

// Helper to format view count
const formatViewCount = (count: number | null | undefined): string => {
  if (!count) return '0 views'
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`
  }
  return `${count} views`
}

export function ConceptQuickSelector({
  slideType,
  slideIndex,
  onApply,
  onAutoFill,
  currentConceptId,
  currentExampleIndex = 0,
  currentExampleIds = [],
  onCycle,
  isApplying = false
}: ConceptQuickSelectorProps) {
  const [open, setOpen] = useState(false)
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null)
  const [applyingExampleId, setApplyingExampleId] = useState<string | null>(null)

  // Check if we can cycle (has a concept selected with multiple examples)
  const canCycle = currentConceptId && currentExampleIds.length > 1

  // Fetch concepts when popover opens
  useEffect(() => {
    if (!open || !slideType) return

    const fetchConcepts = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/concepts?type=${slideType}`)
        if (!response.ok) {
          throw new Error('Failed to fetch concepts')
        }
        const data = await response.json()
        setConcepts(data.concepts || [])
      } catch (error) {
        console.error('Failed to fetch concepts:', error)
        toast.error('Failed to load concepts')
      } finally {
        setIsLoading(false)
      }
    }

    fetchConcepts()
  }, [open, slideType])

  // Reset expanded concept when popover closes
  useEffect(() => {
    if (!open) {
      setExpandedConcept(null)
    }
  }, [open])

  const handleToggleConcept = useCallback((conceptId: string) => {
    setExpandedConcept(prev => prev === conceptId ? null : conceptId)
  }, [])

  const handleSelectExample = useCallback(async (
    concept: Concept,
    example: ConceptExample
  ) => {
    setApplyingExampleId(example.id)
    try {
      // Get all example IDs for cycling
      const exampleIds = concept.examples.map(e => e.id)

      // Wait for the apply to complete before triggering auto-fill
      await onApply(example.text, concept.id, concept.title, example.id, exampleIds)
      setOpen(false)

      // If this is a HOOK slide (slideIndex 0) and we have an auto-fill handler, trigger it
      console.log('[ConceptQuickSelector] Auto-fill check:', {
        slideType,
        slideIndex,
        hasAutoFill: !!onAutoFill,
        shouldTrigger: slideType?.toUpperCase() === 'HOOK' && slideIndex === 0 && onAutoFill
      })

      if (slideType?.toUpperCase() === 'HOOK' && slideIndex === 0 && onAutoFill) {
        console.log('[ConceptQuickSelector] Apply completed, triggering auto-fill in 1000ms...')
        // Delay to ensure the database transaction has completed
        // This prevents a race condition where auto-fill reads stale data
        setTimeout(() => {
          console.log('[ConceptQuickSelector] Calling onAutoFill()')
          onAutoFill()
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to apply example:', error)
    } finally {
      setApplyingExampleId(null)
    }
  }, [onApply, slideType, slideIndex, onAutoFill])

  // Disable if no slide type
  if (!slideType) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Lightbulb className="h-5 w-5" />
        <span className="text-xs">Classify slide first</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4" />
                Select Example
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="center" side="bottom">
          <Command>
            <CommandInput placeholder={`Search ${slideType} concepts...`} />
            <CommandList className="max-h-64">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading concepts...</span>
                </div>
              ) : concepts.length === 0 ? (
                <CommandEmpty>
                  <div className="py-6 text-center text-sm">
                    <p className="text-muted-foreground">No {slideType} concepts found.</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setOpen(false)
                        window.open('/concepts', '_blank')
                      }}
                      className="mt-2"
                    >
                      Create one in Concept Bank
                    </Button>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {concepts.map(concept => (
                    <div key={concept.id} className="border-b last:border-0">
                      <CommandItem
                        value={concept.title}
                        onSelect={() => handleToggleConcept(concept.id)}
                        className="flex items-start gap-2 py-2 cursor-pointer"
                      >
                        <div className="flex-shrink-0 pt-0.5">
                          {expandedConcept === concept.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{concept.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {concept.coreMessage}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {concept.examples.length} example{concept.examples.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </CommandItem>

                      {/* Examples list */}
                      {expandedConcept === concept.id && (
                        <div className="pl-6 pr-2 pb-2 space-y-1">
                          {concept.examples.map(example => (
                            <div
                              key={example.id}
                              className={cn(
                                'p-2 rounded border cursor-pointer hover:bg-accent transition-colors',
                                applyingExampleId === example.id && 'opacity-50 pointer-events-none'
                              )}
                              onClick={() => handleSelectExample(concept, example)}
                            >
                              <div className="text-xs line-clamp-2">{example.text}</div>
                              {example.sourcePost?.viewCount && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  {formatViewCount(example.sourcePost.viewCount)}
                                </div>
                              )}
                              {applyingExampleId === example.id && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span className="text-[10px] text-muted-foreground">Applying...</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Cycle button - shows when we have a concept with multiple examples */}
      {canCycle && onCycle && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-7"
          onClick={onCycle}
          disabled={isApplying}
        >
          <RefreshCw className="h-3 w-3" />
          Next Example ({currentExampleIndex + 1}/{currentExampleIds.length})
        </Button>
      )}
    </div>
  )
}
