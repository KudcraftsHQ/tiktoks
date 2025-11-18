'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Copy, Check, X, Plus, MoveDown } from 'lucide-react'
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
  textBoxMode?: boolean // When true, split by newlines and render multiple textareas (one per text box)
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
  textBoxMode = false
}: InlineEditableTextProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // For text box mode: split value into array of text boxes
  const [textBoxes, setTextBoxes] = useState<string[]>(() =>
    textBoxMode ? value.split('\n').filter(line => line.trim() !== '') : []
  )

  // Show highlighted text when search terms exist and not focused
  const showHighlightedView = searchTerms.length > 0 && !isFocused

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value)
    if (textBoxMode) {
      setTextBoxes(value.split('\n').filter(line => line.trim() !== ''))
    }
  }, [value, textBoxMode])

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

  // Text box mode handlers
  const handleTextBoxChange = (index: number, newText: string) => {
    const updated = [...textBoxes]
    updated[index] = newText
    setTextBoxes(updated)
  }

  const handleTextBoxBlur = async (index: number) => {
    // Join all text boxes with newlines and save
    const joinedText = textBoxes.join('\n')
    if (joinedText !== value && !isSaving) {
      setIsSaving(true)
      try {
        await onSave(joinedText)
        setLocalValue(joinedText)
      } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to save changes')
        // Revert
        setTextBoxes(value.split('\n').filter(line => line.trim() !== ''))
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleAddTextBox = () => {
    setTextBoxes([...textBoxes, ''])
  }

  const handleRemoveTextBox = async (index: number) => {
    if (textBoxes.length <= 1) {
      toast.error('Cannot remove the last text box')
      return
    }

    const updated = textBoxes.filter((_, i) => i !== index)
    setTextBoxes(updated)

    // Auto-save after removal
    const joinedText = updated.join('\n')
    setIsSaving(true)
    try {
      await onSave(joinedText)
      setLocalValue(joinedText)
      toast.success('Text box removed')
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save changes')
      // Revert
      setTextBoxes(value.split('\n').filter(line => line.trim() !== ''))
    } finally {
      setIsSaving(false)
    }
  }

  const handleMergeTextBox = async (index: number) => {
    if (index >= textBoxes.length - 1) {
      toast.error('Cannot merge the last text box')
      return
    }

    // Merge current text box with the next one
    const updated = [...textBoxes]
    updated[index] = `${updated[index]}\n${updated[index + 1]}`
    updated.splice(index + 1, 1)
    setTextBoxes(updated)

    // Auto-save after merge
    const joinedText = updated.join('\n')
    setIsSaving(true)
    try {
      await onSave(joinedText)
      setLocalValue(joinedText)
      toast.success('Text boxes merged')
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save changes')
      // Revert
      setTextBoxes(value.split('\n').filter(line => line.trim() !== ''))
    } finally {
      setIsSaving(false)
    }
  }

  // Text box mode rendering
  if (textBoxMode) {
    return (
      <div className={cn('space-y-2', fixedHeight && heightClass, 'overflow-y-auto')}>
        {textBoxes.map((text, index) => (
          <div key={index} className="relative group/textbox">
            <Textarea
              value={text}
              onChange={(e) => handleTextBoxChange(index, e.target.value)}
              onBlur={() => handleTextBoxBlur(index)}
              placeholder={`Text box ${index + 1}`}
              maxLength={maxLength}
              rows={2}
              disabled={disabled || isSaving}
              className={cn(
                'pr-16 resize-none text-[10px] leading-tight whitespace-pre-wrap break-words',
                isSaving && 'opacity-50 pointer-events-none',
                disabled && 'cursor-not-allowed bg-muted/50',
                className
              )}
              style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
            />
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/textbox:opacity-100 transition-opacity">
              {index < textBoxes.length - 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleMergeTextBox(index)}
                  disabled={isSaving || disabled}
                  title="Merge with next text box"
                >
                  <MoveDown className="h-3 w-3 text-blue-500" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => handleRemoveTextBox(index)}
                disabled={isSaving || disabled || textBoxes.length <= 1}
                title="Remove text box"
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
            <div className="absolute bottom-1 right-1 text-[10px] text-muted-foreground">
              Box {index + 1}
            </div>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs"
          onClick={handleAddTextBox}
          disabled={isSaving || disabled}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Text Box
        </Button>
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    )
  }

  // Standard mode rendering
  return (
    <div className={cn('relative group', fixedHeight && 'h-full')}>
      {showHighlightedView ? (
        // Highlighted view when searching
        <div
          className={cn(
            'px-3 py-2 border rounded-md bg-background cursor-text whitespace-pre-wrap overflow-y-auto',
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
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
        disabled={isSaving || disabled}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
      {isSaving && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  )
}
