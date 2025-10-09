'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Maximize2,
  ScanLine,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  ChevronsDown
} from 'lucide-react'

interface BackgroundLayer {
  id?: string
  type: string
  imageId?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fitMode?: 'cover' | 'contain' | 'fill' | 'fit-width' | 'fit-height'
  zIndex: number
  opacity: number
  color?: string
  gradient?: any
  blendMode?: string
}

interface FloatingBackgroundPanelProps {
  layer: BackgroundLayer | null
  onUpdate: (updates: Partial<BackgroundLayer>) => void
}

export function FloatingBackgroundPanel({
  layer,
  onUpdate
}: FloatingBackgroundPanelProps) {
  if (!layer) return null

  const panelStyle = {
    position: 'absolute' as const,
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10000
  }

  const handleFitWidth = () => {
    onUpdate({ width: 1, height: 1, x: 0, y: 0 })
  }

  const handleFitHeight = () => {
    onUpdate({ width: 1, height: 1, x: 0, y: 0 })
  }

  const handleAlignCenter = () => {
    onUpdate({ x: 0, y: 0 })
  }

  const handleAlignLeft = () => {
    onUpdate({ x: -(layer.width - 1) / 2 })
  }

  const handleAlignRight = () => {
    onUpdate({ x: (layer.width - 1) / 2 })
  }

  const handleAlignTop = () => {
    onUpdate({ y: -(layer.height - 1) / 2 })
  }

  const handleAlignBottom = () => {
    onUpdate({ y: (layer.height - 1) / 2 })
  }

  return (
    <div
      style={panelStyle}
      className="bg-background rounded-lg shadow-lg border border-white/20 p-2 flex items-center gap-1 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Fit to Canvas */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleFitWidth}
        title="Fit to Canvas"
        className="h-8 w-8 p-0"
      >
        <ScanLine className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Center */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAlignCenter}
        title="Center"
        className="h-8 w-8 p-0"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Left */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAlignLeft}
        title="Align Left"
        className="h-8 w-8 p-0"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* Right */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAlignRight}
        title="Align Right"
        className="h-8 w-8 p-0"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>

      {/* Top */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAlignTop}
        title="Align Top"
        className="h-8 w-8 p-0"
      >
        <ChevronsUp className="h-4 w-4" />
      </Button>

      {/* Bottom */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAlignBottom}
        title="Align Bottom"
        className="h-8 w-8 p-0"
      >
        <ChevronsDown className="h-4 w-4" />
      </Button>
    </div>
  )
}
