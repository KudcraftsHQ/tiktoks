'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tag, Lightbulb, Megaphone } from 'lucide-react'

export type SlideType = 'HOOK' | 'CONTENT' | 'CTA'

interface SlideClassificationBadgeProps {
  type: SlideType | null
  categoryName?: string
  onClick?: () => void
  className?: string
}

export function SlideClassificationBadge({
  type,
  categoryName,
  onClick,
  className
}: SlideClassificationBadgeProps) {
  const getTypeConfig = (type: SlideType | null) => {
    switch (type) {
      case 'HOOK':
        return {
          icon: Tag,
          color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20',
          label: 'Hook'
        }
      case 'CONTENT':
        return {
          icon: Lightbulb,
          color: 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20',
          label: 'Content'
        }
      case 'CTA':
        return {
          icon: Megaphone,
          color: 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20',
          label: 'CTA'
        }
      default:
        return {
          icon: Tag,
          color: 'bg-muted text-muted-foreground border-muted hover:bg-muted',
          label: 'Unclassified'
        }
    }
  }

  const config = getTypeConfig(type)
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={`${config.color} ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
      onClick={onClick}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
      {categoryName && `: ${categoryName}`}
    </Badge>
  )
}
