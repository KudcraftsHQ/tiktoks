'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { Loader2, Sparkles } from 'lucide-react'

interface NewConceptFromExamplesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  defaultType: 'HOOK' | 'CONTENT' | 'CTA'
  onConfirm: (data: { title?: string; coreMessage?: string; type: 'HOOK' | 'CONTENT' | 'CTA'; autoGenerate: boolean }) => Promise<void>
}

export function NewConceptFromExamplesDialog({
  open,
  onOpenChange,
  selectedCount,
  defaultType,
  onConfirm
}: NewConceptFromExamplesDialogProps) {
  const [title, setTitle] = useState('')
  const [coreMessage, setCoreMessage] = useState('')
  const [type, setType] = useState<'HOOK' | 'CONTENT' | 'CTA'>(defaultType)
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm({
        title: autoGenerate ? undefined : title,
        coreMessage: autoGenerate ? undefined : coreMessage,
        type,
        autoGenerate
      })
      onOpenChange(false)
      // Reset form
      setTitle('')
      setCoreMessage('')
      setAutoGenerate(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTitle('')
    setCoreMessage('')
    setAutoGenerate(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Concept</DialogTitle>
          <DialogDescription>
            Create a new concept from {selectedCount} selected example{selectedCount > 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Concept Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'HOOK' | 'CONTENT' | 'CTA')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOOK">Hook - Opening slide patterns</SelectItem>
                <SelectItem value="CONTENT">Content - Body slide lessons</SelectItem>
                <SelectItem value="CTA">CTA - Call to action patterns</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto-generate toggle */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Auto-generate with AI</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Let AI analyze the examples and generate a title and description
              </p>
            </div>
            <Button
              variant={autoGenerate ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoGenerate(!autoGenerate)}
            >
              {autoGenerate ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {/* Manual input fields (shown when auto-generate is off) */}
          {!autoGenerate && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter concept title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coreMessage">Core Message</Label>
                <Textarea
                  id="coreMessage"
                  placeholder="Describe the core message or pattern..."
                  value={coreMessage}
                  onChange={(e) => setCoreMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (!autoGenerate && (!title.trim() || !coreMessage.trim()))}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {autoGenerate ? 'Create with AI' : 'Create Concept'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
