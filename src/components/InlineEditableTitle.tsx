'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InlineEditableTitleProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  placeholder?: string
  className?: string
  maxLength?: number
}

export function InlineEditableTitle({
  value,
  onSave,
  placeholder = 'Enter title...',
  className,
  maxLength = 200,
}: InlineEditableTitleProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setLocalValue(value)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus
        disabled={isSaving}
        className={cn(
          'h-auto py-0 px-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
          isSaving && 'opacity-50 pointer-events-none',
          className
        )}
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        'cursor-text hover:text-muted-foreground transition-colors py-0',
        className
      )}
    >
      {localValue || placeholder}
    </div>
  )
}
