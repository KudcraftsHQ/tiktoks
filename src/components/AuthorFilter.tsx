'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Check, ChevronDown, Search, X, Loader2 } from 'lucide-react'

interface AuthorFilterProps {
  selectedAuthors: string[]
  availableAuthors: string[]
  onChange: (authors: string[]) => void
  isLoading?: boolean
}

export default function AuthorFilter({ 
  selectedAuthors, 
  availableAuthors, 
  onChange,
  isLoading = false 
}: AuthorFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredAuthors = availableAuthors.filter(author =>
    author.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleAuthor = (author: string) => {
    if (selectedAuthors.includes(author)) {
      onChange(selectedAuthors.filter(a => a !== author))
    } else {
      onChange([...selectedAuthors, author])
    }
  }

  const removeAuthor = (author: string) => {
    onChange(selectedAuthors.filter(a => a !== author))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-foreground mb-2 block">
        Authors
      </label>
      
      {/* Selected Authors Display */}
      {selectedAuthors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedAuthors.map(author => (
            <Badge
              key={author}
              variant="secondary"
              className="text-xs"
            >
              {author}
              <button
                onClick={() => removeAuthor(author)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Dropdown Trigger */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
        disabled={isLoading}
      >
        <span className="text-muted-foreground">
          {selectedAuthors.length > 0 
            ? `${selectedAuthors.length} selected`
            : 'Select authors...'
          }
        </span>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {/* Dropdown Content */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80">
          <CardContent className="p-3">
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Authors List */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredAuthors.length > 0 ? (
                filteredAuthors.map(author => {
                  const isSelected = selectedAuthors.includes(author)
                  return (
                    <div
                      key={author}
                      onClick={() => toggleAuthor(author)}
                      className="flex items-center gap-2 p-2 rounded-sm hover:bg-accent cursor-pointer"
                    >
                      <div className={`flex items-center justify-center w-4 h-4 border rounded-sm ${
                        isSelected 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-muted-foreground'
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm flex-1 truncate">{author}</span>
                    </div>
                  )
                })
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? 'No authors found' : 'No authors available'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}