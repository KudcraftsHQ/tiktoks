'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface ProductContext {
  id: string
  title: string
  description: string
}

interface CreateRemixDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
  onRemixCreated: () => void
}

export function CreateRemixDialog({
  open,
  onOpenChange,
  postId,
  onRemixCreated,
}: CreateRemixDialogProps) {
  const [productContexts, setProductContexts] = useState<ProductContext[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string>('')
  const [additionalPrompt, setAdditionalPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingContexts, setIsFetchingContexts] = useState(false)

  // Fetch product contexts when dialog opens
  useEffect(() => {
    if (open) {
      fetchProductContexts()
    }
  }, [open])

  const fetchProductContexts = async () => {
    setIsFetchingContexts(true)
    try {
      const response = await fetch('/api/product-contexts')
      if (!response.ok) {
        throw new Error('Failed to fetch product contexts')
      }
      const data = await response.json()
      setProductContexts(data)
    } catch (error) {
      console.error('Failed to fetch product contexts:', error)
      toast.error('Failed to load product contexts')
    } finally {
      setIsFetchingContexts(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedContextId) {
      toast.error('Please select a product context')
      return
    }

    setIsLoading(true)
    try {
      const selectedContext = productContexts.find(
        (ctx) => ctx.id === selectedContextId
      )
      const remixName = `Remix - ${selectedContext?.title || 'Unknown'}`

      const response = await fetch(`/api/tiktok/posts/${postId}/remix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: remixName,
          description: `AI-generated remix variation for ${selectedContext?.title}`,
          productContextId: selectedContextId,
          additionalPrompt: additionalPrompt.trim() || undefined,
          options: {
            style: 'casual',
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Failed to create remix')
      }

      toast.success('Remix created successfully')
      onRemixCreated()
      onOpenChange(false)

      // Reset form
      setSelectedContextId('')
      setAdditionalPrompt('')
    } catch (error) {
      console.error('Failed to create remix:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create remix'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Create Remix
          </DialogTitle>
          <DialogDescription>
            Select a product context to paraphrase the content for a specific audience or product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-hidden">
          {/* Product Context Selector */}
          <div className="space-y-2 overflow-hidden">
            <Label htmlFor="product-context">
              Product Context <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedContextId}
              onValueChange={setSelectedContextId}
              disabled={isFetchingContexts || isLoading}
            >
              <SelectTrigger id="product-context">
                <SelectValue placeholder="Select a product context..." />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(500px-3rem)]">
                {isFetchingContexts ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Loading...
                  </div>
                ) : productContexts.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No product contexts available
                  </div>
                ) : (
                  productContexts.map((context) => (
                    <SelectItem key={context.id} value={context.id}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{context.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {context.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedContextId && (
              <p className="text-xs text-muted-foreground line-clamp-3 break-words overflow-hidden">
                {
                  productContexts.find((ctx) => ctx.id === selectedContextId)
                    ?.description
                }
              </p>
            )}
          </div>

          {/* Additional Prompt (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="additional-prompt">
              Additional Prompt <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="additional-prompt"
              placeholder="Add any specific instructions for the AI paraphrasing..."
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Use this to provide additional context or specific requirements for the remix.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedContextId || isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Create Remix
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
