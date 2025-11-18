'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { CANVAS_SIZES } from '@/lib/validations/remix-schema'
import { toast } from 'sonner'

interface DraftSettingsDialogProps {
  open: boolean
  onClose: () => void
  draftId: string
  currentCanvasSize?: { width: number; height: number }
  onSave?: () => void
}

type CanvasSizeKey = keyof typeof CANVAS_SIZES

export function DraftSettingsDialog({
  open,
  onClose,
  draftId,
  currentCanvasSize,
  onSave
}: DraftSettingsDialogProps) {
  const [selectedSize, setSelectedSize] = useState<CanvasSizeKey>(() => {
    // Detect current canvas size
    if (!currentCanvasSize) return 'TIKTOK_PHOTO_MODE'

    const current = currentCanvasSize
    for (const [key, value] of Object.entries(CANVAS_SIZES)) {
      if (value.width === current.width && value.height === current.height) {
        return key as CanvasSizeKey
      }
    }
    return 'TIKTOK_PHOTO_MODE'
  })
  const [applyToAllSlides, setApplyToAllSlides] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const canvasSize = CANVAS_SIZES[selectedSize]

      const response = await fetch(`/api/remixes/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          canvasSize,
          applyToAllSlides
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update canvas size')
      }

      toast.success('Canvas size updated successfully')
      onSave?.()
      onClose()
    } catch (error) {
      console.error('Failed to update canvas size:', error)
      toast.error('Failed to update canvas size')
    } finally {
      setIsSaving(false)
    }
  }

  const canvasSizeOptions: Array<{ key: CanvasSizeKey; label: string; description: string }> = [
    { key: 'TIKTOK_PHOTO_MODE', label: 'TikTok Photo Mode', description: '3:4 Portrait (1080 × 1440)' },
    { key: 'INSTAGRAM_STORY', label: 'Instagram Story', description: '9:16 Portrait (1080 × 1920)' },
    { key: 'INSTAGRAM_POST', label: 'Instagram Post', description: '1:1 Square (1080 × 1080)' },
    { key: 'INSTAGRAM_LANDSCAPE', label: 'Instagram Landscape', description: '16:9 (1080 × 566)' },
    { key: 'TIKTOK_VERTICAL', label: 'TikTok Vertical', description: '9:16 Portrait (1080 × 1920)' }
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Draft Settings</DialogTitle>
          <DialogDescription>
            Configure canvas dimensions for this draft
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Canvas Size Selection */}
          <div className="space-y-3">
            <Label>Canvas Size</Label>
            <RadioGroup value={selectedSize} onValueChange={(value) => setSelectedSize(value as CanvasSizeKey)}>
              {canvasSizeOptions.map((option) => (
                <div key={option.key} className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value={option.key} id={option.key} className="mt-1" />
                  <Label htmlFor={option.key} className="cursor-pointer flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Apply to All Slides */}
          <div className="flex items-center space-x-2 pt-4 border-t">
            <Checkbox
              id="apply-all"
              checked={applyToAllSlides}
              onCheckedChange={(checked) => setApplyToAllSlides(checked as boolean)}
            />
            <Label htmlFor="apply-all" className="cursor-pointer text-sm">
              Apply to all slides in this draft
            </Label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
