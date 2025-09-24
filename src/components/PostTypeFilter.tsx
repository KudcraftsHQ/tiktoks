'use client'

import { Button } from '@/components/ui/button'
import { Video, Image, Grid3X3 } from 'lucide-react'

interface PostTypeFilterProps {
  value: 'all' | 'video' | 'photo'
  onChange: (value: 'all' | 'video' | 'photo') => void
}

export function PostTypeFilter({ value, onChange }: PostTypeFilterProps) {
  const options = [
    { value: 'all' as const, label: 'All Posts', icon: Grid3X3 },
    { value: 'video' as const, label: 'Videos', icon: Video },
    { value: 'photo' as const, label: 'Photos', icon: Image }
  ]

  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1">
      {options.map((option) => {
        const Icon = option.icon
        const isActive = value === option.value

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}