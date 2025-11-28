'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { Loader2, Check, ChevronRight, ChevronDown } from 'lucide-react'
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

interface ConceptSelectorPopoverProps {
  slideType: 'HOOK' | 'CONTENT' | 'CTA' | null
  currentConceptTitle?: string | null
  currentConceptId?: string | null
  onApply: (
    text: string,
    conceptId: string,
    exampleId: string,
    mode: 'copy' | 'paraphrase',
    intensity?: 'minimal' | 'medium' | 'high'
  ) => Promise<void>
  trigger: React.ReactNode
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

export function ConceptSelectorPopover({
  slideType,
  currentConceptTitle,
  currentConceptId,
  onApply,
  trigger
}: ConceptSelectorPopoverProps) {
  const [open, setOpen] = useState(false)
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null)
  const [selectedExample, setSelectedExample] = useState<{
    conceptId: string
    conceptTitle: string
    exampleId: string
    text: string
  } | null>(null)
  const [mode, setMode] = useState<'copy' | 'paraphrase'>('copy')
  const [intensity, setIntensity] = useState<'minimal' | 'medium' | 'high'>('minimal')
  const [isApplying, setIsApplying] = useState(false)

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

  // Reset selection when popover closes
  useEffect(() => {
    if (!open) {
      setSelectedExample(null)
      setExpandedConcept(null)
      setMode('copy')
      setIntensity('minimal')
    }
  }, [open])

  const handleToggleConcept = useCallback((conceptId: string) => {
    setExpandedConcept(prev => prev === conceptId ? null : conceptId)
  }, [])

  const handleSelectExample = useCallback((
    conceptId: string,
    conceptTitle: string,
    exampleId: string,
    text: string
  ) => {
    setSelectedExample({ conceptId, conceptTitle, exampleId, text })
  }, [])

  const handleApply = useCallback(async () => {
    if (!selectedExample) return

    setIsApplying(true)
    try {
      await onApply(
        selectedExample.text,
        selectedExample.conceptId,
        selectedExample.exampleId,
        mode,
        mode === 'paraphrase' ? intensity : undefined
      )
      toast.success(mode === 'copy' ? 'Example copied' : 'Example paraphrased')
      setOpen(false)
    } catch (error) {
      console.error('Failed to apply example:', error)
      toast.error('Failed to apply example')
    } finally {
      setIsApplying(false)
    }
  }, [selectedExample, mode, intensity, onApply])

  // Disable if no slide type
  if (!slideType) {
    return (
      <div className="relative group/disabled">
        {trigger}
        <div className="absolute left-0 top-full mt-1 hidden group-hover/disabled:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
          Classify this slide first
        </div>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start" side="bottom">
        <Command>
          <CommandInput placeholder={`Search ${slideType} concepts...`} />
          <CommandList>
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
                              selectedExample?.exampleId === example.id && 'bg-accent border-primary'
                            )}
                            onClick={() => handleSelectExample(
                              concept.id,
                              concept.title,
                              example.id,
                              example.text
                            )}
                          >
                            <div className="text-xs line-clamp-2">{example.text}</div>
                            {example.sourcePost?.viewCount && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {formatViewCount(example.sourcePost.viewCount)}
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

        {/* Selection controls */}
        {selectedExample && (
          <div className="border-t p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">
              Selected: {selectedExample.conceptTitle}
            </div>

            {/* Mode selection */}
            <div className="space-y-2">
              <Label className="text-xs">Action</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'copy' | 'paraphrase')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="copy" id="copy" />
                  <Label htmlFor="copy" className="text-sm font-normal cursor-pointer">
                    Copy directly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="paraphrase" id="paraphrase" />
                  <Label htmlFor="paraphrase" className="text-sm font-normal cursor-pointer">
                    Paraphrase with AI
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Intensity selection (only for paraphrase mode) */}
            {mode === 'paraphrase' && (
              <div className="space-y-2">
                <Label className="text-xs">Intensity</Label>
                <RadioGroup value={intensity} onValueChange={(v) => setIntensity(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="minimal" id="minimal" />
                    <Label htmlFor="minimal" className="text-sm font-normal cursor-pointer">
                      Minimal - Small changes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium" className="text-sm font-normal cursor-pointer">
                      Medium - Moderate rewrite
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="text-sm font-normal cursor-pointer">
                      High - Creative rewrite
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Apply button */}
            <Button
              onClick={handleApply}
              disabled={isApplying}
              className="w-full"
              size="sm"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  {mode === 'copy' ? 'Copying...' : 'Paraphrasing...'}
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-2" />
                  {mode === 'copy' ? 'Copy to Slide' : `Paraphrase (${intensity})`}
                </>
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
