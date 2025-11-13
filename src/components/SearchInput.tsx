'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  isLoading?: boolean
  className?: string
  maxLength?: number
}

/**
 * Manual search input component with Enter key or button submit
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  isLoading = false,
  className = '',
  maxLength = 100
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false)

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, maxLength)
    setLocalValue(newValue)
  }, [maxLength])

  const handleSubmit = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue)
    }
  }, [localValue, value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (localValue !== value) {
        onChange(localValue)
      }
    }
  }, [localValue, value, onChange])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onChange('')
  }, [onChange])

  return (
    <>
      {/* Desktop: Inline search bar */}
      <div className="hidden sm:block">
        <div className={cn('relative', className)}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pl-8 pr-8 h-8 text-xs w-full sm:w-80"
            disabled={isLoading}
          />
          {isLoading ? (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : localValue ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mobile: Search button that opens dialog */}
      <div className="sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileDialogOpen(true)}
          className="h-8 w-8 p-0"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Dialog open={isMobileDialogOpen} onOpenChange={setIsMobileDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Search Posts</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={localValue}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSubmit()
                      setIsMobileDialogOpen(false)
                    }
                  }}
                  placeholder={placeholder}
                  className="pl-8 pr-8"
                  autoFocus
                  disabled={isLoading}
                />
                {localValue && !isLoading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Search by author name, handle, description, or slide content. Press Enter or click Search button.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsMobileDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleSubmit()
                    setIsMobileDialogOpen(false)
                  }}
                  disabled={isLoading || localValue === value}
                  className="flex-1 gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
