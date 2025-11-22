'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'

type GenerationMode = 'paraphrase' | 'change_angle' | 'fresh_take'

interface Concept {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  examples: Array<{ id: string; text: string }>
}

interface GeneratedExample {
  id: string
  text: string
  sourceType: string
  sourcePostId: null
  sourceSlideIndex: null
  createdAt: string
  sourcePost: null
}

interface GenerateExampleDialogProps {
  concept: Concept
  open: boolean
  onOpenChange: (open: boolean) => void
  onExamplesAdded: (conceptId: string, examples: GeneratedExample[]) => void
}

const modeOptions = [
  {
    value: 'paraphrase',
    label: 'Paraphrase',
    description: 'Same message, different wording'
  },
  {
    value: 'change_angle',
    label: 'Change Angle',
    description: 'Different perspective or framing'
  },
  {
    value: 'fresh_take',
    label: 'Fresh Take',
    description: 'Completely new creative approach'
  }
]

export function GenerateExampleDialog({
  concept,
  open,
  onOpenChange,
  onExamplesAdded
}: GenerateExampleDialogProps) {
  const [mode, setMode] = useState<GenerationMode>('paraphrase')
  const [customPrompt, setCustomPrompt] = useState('')
  const [variationCount, setVariationCount] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)

    try {
      // Generate examples
      const response = await fetch(`/api/concepts/${concept.id}/examples/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          customPrompt: customPrompt.trim() || undefined,
          variationCount
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate examples')
      }

      const data = await response.json()
      const variations = data.variations as Array<{ text: string; rationale: string }>

      // Auto-add all generated examples and collect the created records
      const createdExamples: GeneratedExample[] = []
      for (const variation of variations) {
        const addResponse = await fetch(`/api/concepts/${concept.id}/examples`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: variation.text,
            sourceType: 'AI_GENERATED'
          })
        })

        if (!addResponse.ok) {
          throw new Error('Failed to add example')
        }

        const createdExample = await addResponse.json()
        createdExamples.push({
          id: createdExample.id,
          text: createdExample.text,
          sourceType: createdExample.sourceType,
          sourcePostId: null,
          sourceSlideIndex: null,
          createdAt: createdExample.createdAt,
          sourcePost: null
        })
      }

      toast.success(`Added ${variations.length} example${variations.length > 1 ? 's' : ''}`)
      onExamplesAdded(concept.id, createdExamples)
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate examples')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    // Reset state
    setCustomPrompt('')
    setMode('paraphrase')
    setVariationCount(1)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate Example
          </DialogTitle>
          <DialogDescription>
            AI-generate new example copy for this concept
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Concept info - compact header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{concept.title}</span>
                <SlideClassificationBadge type={concept.type} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{concept.coreMessage}</p>
            </div>
            {concept.examples.length > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {concept.examples.length} ref{concept.examples.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Mode and Count */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as GenerationMode)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {modeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Count</Label>
              <div className="flex gap-1">
                {[1, 2, 3].map((count) => (
                  <Button
                    key={count}
                    variant={variationCount === count ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVariationCount(count)}
                    className="w-9 h-9"
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom instructions */}
          <div className="space-y-1.5">
            <Label className="text-xs">Custom Instructions (optional)</Label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Make it more casual, add humor..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate & Add
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
