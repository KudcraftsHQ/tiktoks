'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, CheckCircle2, Sparkles, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Simple word-level diff highlighting
function highlightDiff(before: string, after: string): React.ReactNode {
  const beforeWords = before.split(/(\s+)/)
  const afterWords = after.split(/(\s+)/)

  // Create a Set of words from before for quick lookup
  const beforeSet = new Set(beforeWords.map(w => w.toLowerCase().trim()).filter(w => w.length > 0))

  // Mark words in after that don't exist in before
  return afterWords.map((word, i) => {
    const trimmedWord = word.toLowerCase().trim()
    // Check if this word (ignoring case) exists in before
    const isNew = trimmedWord.length > 0 && !beforeSet.has(trimmedWord)

    if (isNew) {
      return (
        <span key={i} className="bg-green-300 dark:bg-green-700 rounded px-0.5">
          {word}
        </span>
      )
    }
    return word
  })
}

interface CoherenceIssue {
  type: 'pov_inconsistency' | 'voice_mismatch' | 'tone_jump' | 'product_mismatch'
  slideIndices: number[]
  description: string
  severity: 'high' | 'medium' | 'low'
  currentValue?: string
  suggestedValue?: string
}

interface CoherenceAnalysis {
  issues: CoherenceIssue[]
  affectedSlideCount: number
  recommendation: string
}

interface FixCoherenceDialogProps {
  open: boolean
  onClose: () => void
  draftId: string
  onFixed: () => void
  onApplyOptimistically?: (draftId: string, fixes: Array<{ slideIndex: number; fixedText: string }>) => Promise<{ rollback: () => void }>
}

// Helper to get issue type label
const getIssueTypeLabel = (type: string): string => {
  switch (type) {
    case 'pov_inconsistency':
      return 'POV Inconsistency'
    case 'voice_mismatch':
      return 'Voice Mismatch'
    case 'tone_jump':
      return 'Tone Jump'
    case 'product_mismatch':
      return 'Product Mismatch'
    default:
      return type
  }
}

// Helper to get severity color
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'high':
      return 'destructive'
    case 'medium':
      return 'default'
    case 'low':
      return 'secondary'
    default:
      return 'default'
  }
}

// Helper to get issue type color (for badge background)
const getIssueTypeColor = (type: string): string => {
  switch (type) {
    case 'pov_inconsistency':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'voice_mismatch':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    case 'tone_jump':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'product_mismatch':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

export function FixCoherenceDialog({
  open,
  onClose,
  draftId,
  onFixed,
  onApplyOptimistically
}: FixCoherenceDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<CoherenceAnalysis | null>(null)
  const [isFixing, setIsFixing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [beforeAfter, setBeforeAfter] = useState<Array<{
    slideIndex: number
    before: string
    after: string
    changes: string
  }> | null>(null)
  const [allSlides, setAllSlides] = useState<Array<{
    slideIndex: number
    slideType: string
    before: string
    after: string
    changes: string
    hasChanges: boolean
  }> | null>(null)
  const [showBeforeAfter, setShowBeforeAfter] = useState(false)

  // Auto-analyze when dialog opens
  useEffect(() => {
    if (!open || !draftId) return

    const analyze = async () => {
      setIsAnalyzing(true)
      setError(null)
      setAnalysis(null)
      setBeforeAfter(null)
      setAllSlides(null)
      setShowBeforeAfter(false)

      try {
        const response = await fetch(`/api/remixes/${draftId}/analyze-coherence`, {
          method: 'POST'
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to analyze coherence')
        }

        const data = await response.json()
        setAnalysis(data)

        // If no issues found, show success and close after delay
        if (data.issues.length === 0) {
          toast.success('No coherence issues detected')
          setTimeout(() => {
            onClose()
          }, 2000)
        }
      } catch (error) {
        console.error('Failed to analyze coherence:', error)
        setError(error instanceof Error ? error.message : 'Failed to analyze coherence')
        toast.error('Failed to analyze coherence')
      } finally {
        setIsAnalyzing(false)
      }
    }

    analyze()
  }, [open, draftId, onClose])

  // Generate preview of fixes (doesn't save to DB)
  const handleGeneratePreview = async () => {
    if (!draftId) return

    setIsFixing(true)
    try {
      const response = await fetch(`/api/remixes/${draftId}/preview-coherence-fix`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate preview')
      }

      const data = await response.json()

      // Store before/after for preview
      setBeforeAfter(data.beforeAfter || [])
      setAllSlides(data.allSlides || [])
      setShowBeforeAfter(true)

      toast.success('Preview generated', {
        description: `${data.beforeAfter.length} slide${data.beforeAfter.length !== 1 ? 's' : ''} will be updated`
      })
    } catch (error) {
      console.error('Failed to generate preview:', error)
      toast.error('Failed to generate preview', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsFixing(false)
    }
  }

  // Apply the fixes (saves to DB with optimistic update)
  const handleApplyFixes = async () => {
    if (!draftId || !beforeAfter) return

    const fixes = beforeAfter.map(item => ({
      slideIndex: item.slideIndex,
      fixedText: item.after
    }))

    setIsFixing(true)

    // Apply optimistically if callback provided
    let rollback: (() => void) | null = null
    if (onApplyOptimistically) {
      try {
        const result = await onApplyOptimistically(draftId, fixes)
        rollback = result.rollback
      } catch (error) {
        // Optimistic update failed, but continue with API call
        console.warn('Optimistic update failed:', error)
      }
    }

    try {
      const response = await fetch(`/api/remixes/${draftId}/apply-coherence-fix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fixes })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to apply fixes')
      }

      toast.success('Content coherence fixed', {
        description: `Fixed ${beforeAfter.length} slide${beforeAfter.length !== 1 ? 's' : ''}`
      })

      onFixed()
      onClose()
    } catch (error) {
      console.error('Failed to apply fixes:', error)
      toast.error('Failed to apply fixes', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
      // Rollback optimistic update on error
      if (rollback) {
        rollback()
      }
    } finally {
      setIsFixing(false)
    }
  }

  // Cancel preview and go back to analysis
  const handleCancelPreview = () => {
    setBeforeAfter(null)
    setAllSlides(null)
    setShowBeforeAfter(false)
  }

  // Get slide type badge variant
  const getSlideTypeBadge = (slideType: string, hasChanges: boolean) => {
    if (slideType === 'HOOK') return { label: 'Hook', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700' }
    if (slideType === 'CTA') return { label: 'CTA', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700' }
    if (hasChanges) return { label: 'Content', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700' }
    return { label: 'Content', className: '' }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Fix Content Coherence
          </DialogTitle>
          <DialogDescription>
            AI analysis of POV, voice, and tone consistency across your carousel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 overflow-y-auto flex-1 min-h-0">
          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Analyzing your carousel...</p>
            </div>
          )}

          {/* Error state */}
          {error && !isAnalyzing && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Analysis Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="mt-3"
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* No issues found */}
          {analysis && analysis.issues.length === 0 && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">No Coherence Issues Detected</p>
              <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
                Your carousel maintains consistent POV, voice, and tone across all slides.
              </p>
            </div>
          )}

          {/* Issues found */}
          {analysis && analysis.issues.length > 0 && !isAnalyzing && (
            <>
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm font-medium mb-2">Analysis Summary</p>
                <p className="text-sm text-muted-foreground">{analysis.recommendation}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline">
                    {analysis.issues.length} issue{analysis.issues.length !== 1 ? 's' : ''} found
                  </Badge>
                  <Badge variant="outline">
                    {analysis.affectedSlideCount} slide{analysis.affectedSlideCount !== 1 ? 's' : ''} affected
                  </Badge>
                </div>
              </div>

              {/* Issues list */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Issues Detected:</p>
                {analysis.issues.map((issue, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant={getSeverityColor(issue.severity) as any}>
                        {issue.severity}
                      </Badge>
                      <span className="text-sm font-medium">
                        {getIssueTypeLabel(issue.type)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Affects slide{issue.slideIndices.length !== 1 ? 's' : ''}: {issue.slideIndices.map(i => i + 1).join(', ')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Warning note */}
              <div className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>Note:</strong> This will only fix CONTENT slides. HOOK and CTA slides will remain unchanged as reference points.
                </p>
              </div>

            </>
          )}

          {/* Before/After Preview - Synchronized scrolling with all slides */}
          {showBeforeAfter && allSlides && allSlides.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-medium">Preview Changes</p>
                <Badge variant="outline">
                  {beforeAfter?.length || 0} slide{(beforeAfter?.length || 0) !== 1 ? 's' : ''} will be updated
                </Badge>
              </div>

              {/* Synchronized scrollable container */}
              <div className="overflow-x-auto pb-2">
                <div className="inline-flex flex-col gap-3 min-w-full">
                  {/* Before Row */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 sticky left-0">Before</p>
                    <div className="flex gap-3">
                      {allSlides.map((slide) => {
                        const typeBadge = getSlideTypeBadge(slide.slideType, slide.hasChanges)
                        return (
                          <div
                            key={`before-${slide.slideIndex}`}
                            className={cn(
                              "flex-shrink-0 w-48 p-3 rounded-lg border",
                              slide.hasChanges ? "bg-muted/30" : "bg-muted/10 opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={cn("text-xs", typeBadge.className)}>
                                {typeBadge.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">#{slide.slideIndex + 1}</span>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {slide.before}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* After Row */}
                  <div>
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 sticky left-0">After (changes highlighted)</p>
                    <div className="flex gap-3">
                      {allSlides.map((slide) => {
                        const typeBadge = getSlideTypeBadge(slide.slideType, slide.hasChanges)
                        return (
                          <div
                            key={`after-${slide.slideIndex}`}
                            className={cn(
                              "flex-shrink-0 w-48 p-3 rounded-lg border",
                              slide.hasChanges
                                ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
                                : "bg-muted/10 opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={cn("text-xs", slide.hasChanges ? "border-green-300 dark:border-green-700" : "", typeBadge.className)}>
                                {typeBadge.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">#{slide.slideIndex + 1}</span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap">
                              {slide.hasChanges ? highlightDiff(slide.before, slide.after) : slide.after}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Changes Summary */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground">Changes</p>
                {allSlides.filter(s => s.hasChanges).map((slide) => (
                  <div key={`changes-${slide.slideIndex}`} className="text-xs text-muted-foreground">
                    <span className="font-medium">Slide {slide.slideIndex + 1}:</span> {slide.changes}
                  </div>
                ))}
                {allSlides.filter(s => !s.hasChanges).length > 0 && (
                  <div className="text-xs text-muted-foreground italic">
                    {allSlides.filter(s => !s.hasChanges).length} slide{allSlides.filter(s => !s.hasChanges).length !== 1 ? 's' : ''} unchanged (Hook, CTA, or already aligned)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer with action buttons for issues */}
        {analysis && analysis.issues.length > 0 && !showBeforeAfter && (
          <div className="border-t bg-background px-6 py-4 flex justify-end gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isFixing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGeneratePreview}
              disabled={isFixing}
            >
              {isFixing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Preview Fixes
                </>
              )}
            </Button>
          </div>
        )}

        {/* Sticky footer with confirm/cancel buttons for preview */}
        {showBeforeAfter && beforeAfter && beforeAfter.length > 0 && (
          <div className="border-t bg-background px-6 py-4 flex justify-end gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleCancelPreview}
              disabled={isFixing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyFixes}
              disabled={isFixing}
            >
              {isFixing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Apply Changes
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
