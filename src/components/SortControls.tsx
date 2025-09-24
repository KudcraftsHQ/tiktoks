'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpDown, ChevronDown } from 'lucide-react'

type SortValue = 'newest' | 'oldest' | 'author-az' | 'author-za' | 'most-images' | 'least-images'

interface SortControlsProps {
  value: SortValue
  onChange: (value: SortValue) => void
}

const sortOptions = [
  { value: 'newest' as const, label: 'Newest First' },
  { value: 'oldest' as const, label: 'Oldest First' },
  { value: 'author-az' as const, label: 'Author A-Z' },
  { value: 'author-za' as const, label: 'Author Z-A' },
  { value: 'most-images' as const, label: 'Most Images' },
  { value: 'least-images' as const, label: 'Least Images' },
]

export default function SortControls({ value, onChange }: SortControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSortSelect = (selectedValue: SortValue) => {
    onChange(selectedValue)
    setIsOpen(false)
  }

  const getDisplayLabel = () => {
    const option = sortOptions.find(opt => opt.value === value)
    return option?.label || 'Newest First'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-sm font-medium text-foreground mb-2 block">
        Sort By
      </label>
      
      {/* Dropdown Trigger */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          {getDisplayLabel()}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* Dropdown Content */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50">
          <CardContent className="p-3">
            <div className="space-y-1">
              {sortOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => handleSortSelect(option.value)}
                  className={`flex items-center p-2 rounded-sm hover:bg-accent cursor-pointer ${
                    value === option.value ? 'bg-accent' : ''
                  }`}
                >
                  <div className={`w-4 h-4 border rounded-full mr-2 ${
                    value === option.value 
                      ? 'bg-primary border-primary' 
                      : 'border-muted-foreground'
                  }`}>
                    {value === option.value && (
                      <div className="w-2 h-2 bg-primary-foreground rounded-full m-0.5" />
                    )}
                  </div>
                  <span className="text-sm">{option.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}