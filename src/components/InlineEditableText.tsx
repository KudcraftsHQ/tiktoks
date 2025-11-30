'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HighlightedText } from '@/components/HighlightedText'

interface InlineEditableTextProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  placeholder?: string
  className?: string
  maxLength?: number
  rows?: number
  disabled?: boolean
  disabledMessage?: string
  fixedHeight?: boolean
  heightClass?: string
  searchTerms?: string[]
  // Empty state button props
  emptyStateButton?: React.ReactNode
  onEmptyStateClick?: () => void
  // Paraphrase props
  slideType?: 'HOOK' | 'CONTENT' | 'CTA'
  draftId?: string | null
}

export function InlineEditableText({
  value,
  onSave,
  placeholder = 'Enter text...',
  className,
  maxLength = 2000,
  rows = 3,
  disabled = false,
  disabledMessage = 'Editing is disabled',
  fixedHeight = false,
  heightClass = 'h-40',
  searchTerms = [],
  emptyStateButton,
  onEmptyStateClick,
  slideType,
  draftId
}: InlineEditableTextProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isParaphrasing, setIsParaphrasing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Show highlighted text when search terms exist and not focused
  const showHighlightedView = searchTerms.length > 0 && !isFocused

  // Debug logging
  useEffect(() => {
    if (searchTerms.length > 0) {
      console.log('[InlineEditableText] searchTerms:', searchTerms, 'showHighlightedView:', showHighlightedView, 'isFocused:', isFocused, 'value:', value?.substring(0, 50))
    }
  }, [searchTerms, showHighlightedView, isFocused, value])

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleBlur = async () => {
    // Only save if value has changed
    if (localValue !== value && !isSaving) {
      setIsSaving(true)
      try {
        await onSave(localValue)
      } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to save changes')
        // Revert to original value on error
        setLocalValue(value)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localValue)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleParaphrase = async () => {
    if (!slideType || !localValue || isParaphrasing || isSaving) {
      return
    }

    setIsParaphrasing(true)
    try {
      const requestBody = {
        text: localValue,
        slideType,
        intensity: 'minimal',
        draftId: slideType === 'CTA' ? draftId : null
      }

      console.log('[InlineEditableText] Paraphrase request:', {
        slideType,
        draftId: slideType === 'CTA' ? draftId : null,
        hasDraftId: !!draftId
      })

      const response = await fetch('/api/paraphrase/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error('Failed to paraphrase')
      }

      const data = await response.json()
      setLocalValue(data.paraphrasedText)

      // Auto-save the paraphrased text
      await onSave(data.paraphrasedText)

      toast.success('Text paraphrased!')
    } catch (error) {
      console.error('Failed to paraphrase:', error)
      toast.error('Failed to paraphrase text')
    } finally {
      setIsParaphrasing(false)
    }
  }
  // Show empty state button when value is empty and button is provided
  const showEmptyState = !localValue && emptyStateButton

  return (
    <div className={cn('relative group', fixedHeight && 'h-full')}>
      {showEmptyState ? (
        // Empty state with centered button
        <div
          className={cn(
            'px-3 py-2 border rounded-md bg-background flex items-center justify-center',
            fixedHeight && 'h-full',
            !fixedHeight && `min-h-[${rows * 1.5}rem]`,
            className
          )}
          onClick={onEmptyStateClick}
        >
          {emptyStateButton}
        </div>
      ) : showHighlightedView ? (
        // Highlighted view when searching - matches Textarea styling
        <div
          className={cn(
            'flex min-h-[60px] w-full rounded-md border border-input px-3 py-2 text-base shadow-sm cursor-text whitespace-pre-wrap overflow-y-auto',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            fixedHeight && 'h-full',
            !fixedHeight && `min-h-[${rows * 1.5}rem]`,
            className
          )}
          onClick={() => {
            setIsFocused(true)
            textareaRef.current?.focus()
          }}
        >
          {localValue ? (
            <HighlightedText text={localValue} searchTerms={searchTerms} />
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
      ) : (
        // Regular textarea when not searching or focused
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            handleBlur()
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={fixedHeight ? undefined : rows}
          disabled={disabled}
          title={disabled ? disabledMessage : undefined}
          className={cn(
            'pr-10 resize-none',
            isSaving && 'opacity-50 pointer-events-none',
            disabled && 'cursor-not-allowed bg-muted/50',
            fixedHeight && 'h-full overflow-y-auto field-sizing-content',
            className // Apply custom className last to allow overrides
          )}
        />
      )}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
          disabled={isSaving || disabled || isParaphrasing}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
        {slideType && localValue && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleParaphrase}
            disabled={isSaving || disabled || isParaphrasing || !localValue}
            title="Quick paraphrase (minimal variation)"
          >
            <Sparkles className={cn("h-3 w-3", isParaphrasing && "animate-pulse")} />
          </Button>
        )}
      </div>
      {(isSaving || isParaphrasing) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            {isParaphrasing && <span className="text-xs text-muted-foreground">Paraphrasing...</span>}
          </div>
        </div>
      )}
    </div>
  )
}
