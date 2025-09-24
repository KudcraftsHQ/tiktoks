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
    <div className="flex space-x-1 bg-muted rounded-lg p-1">
      {options.map((option) => {
        const Icon = option.icon
        const isActive = value === option.value

        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(option.value)}
            className={`flex items-center space-x-2 ${
              isActive
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}