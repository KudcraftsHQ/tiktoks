'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ChevronDown,
  ChevronRight,
  Type,
  Image as ImageIcon,
  Settings,
  Palette,
  Layers,
  Plus,
  Eye,
  MoreHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasSidebarSection {
  id: string
  title: string
  icon: React.ComponentType<any>
  content: React.ReactNode
  isExpanded?: boolean
}

interface CanvasSidebarProps {
  children?: React.ReactNode
  sections: CanvasSidebarSection[]
  className?: string
}

export function CanvasSidebar({ sections: initialSections, className }: CanvasSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(initialSections.filter(s => s.isExpanded).map(s => s.id))
  )

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId)
      } else {
        newExpanded.add(sectionId)
      }
      return newExpanded
    })
  }

  return (
    <div className={cn("w-80 bg-background border-r overflow-y-auto", className)}>
      <div className="space-y-2 p-4">
        {initialSections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const IconComponent = section.icon

          return (
            <Card key={section.id} className="shadow-sm">
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{section.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {section.content}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// Pre-built section components for common use cases
export function TextElementsSection({
  selectedTextBox,
  onAddTextBox,
  onDeleteTextBox,
  textBoxes = []
}: {
  selectedTextBox: any
  onAddTextBox: () => void
  onDeleteTextBox?: (id: string) => void
  textBoxes?: any[]
}) {
  return (
    <div className="space-y-3">
      {!selectedTextBox && (
        <Button
          onClick={onAddTextBox}
          variant="outline"
          size="sm"
          className="w-full justify-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Text
        </Button>
      )}

      {textBoxes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Text Elements ({textBoxes.length})
          </div>
          {textBoxes.map((textBox, index) => (
            <div
              key={textBox.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
            >
              <div className="flex items-center gap-2">
                <Type className="h-3 w-3" />
                <span className="truncate max-w-32">
                  {textBox.text || `Text ${index + 1}`}
                </span>
              </div>
              {onDeleteTextBox && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onDeleteTextBox(textBox.id)}
                >
                  ×
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedTextBox && (
        <div className="text-center py-4 text-muted-foreground">
          <Type className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Text box selected</p>
          <p className="text-xs text-muted-foreground">Use floating panel to edit</p>
        </div>
      )}
    </div>
  )
}

export function BackgroundSection({
  onChangeBackground,
  hasBackgroundImage
}: {
  onChangeBackground: () => void
  hasBackgroundImage?: boolean
}) {
  return (
    <div className="space-y-3">
      <Button
        onClick={onChangeBackground}
        variant="outline"
        size="sm"
        className="w-full justify-start"
      >
        <ImageIcon className="h-4 w-4 mr-2" />
        {hasBackgroundImage ? 'Change Background' : 'Add Background'}
      </Button>

      <div className="grid grid-cols-3 gap-2">
        {/* Color swatches */}
        {['#ffffff', '#000000', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#fad390', '#f8b500'].map((color) => (
          <button
            key={color}
            className="aspect-square rounded border-2 border-gray-200 hover:border-primary transition-colors"
            style={{ backgroundColor: color }}
            title={color}
            onClick={() => {
              // Handle color background
              console.log('Set background color:', color)
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function CanvasSettingsSection({
  canvas,
  onUpdateCanvas,
  presets
}: {
  canvas: any
  onUpdateCanvas: (updates: any) => void
  presets: Array<{ name: string; width: number; height: number }>
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Canvas Size
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-xs text-muted-foreground">Width</label>
          <input
            type="number"
            value={canvas.width}
            onChange={(e) => onUpdateCanvas({ width: parseInt(e.target.value) })}
            className="w-full p-1 border rounded text-xs"
            min="100"
            max="4000"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Height</label>
          <input
            type="number"
            value={canvas.height}
            onChange={(e) => onUpdateCanvas({ height: parseInt(e.target.value) })}
            className="w-full p-1 border rounded text-xs"
            min="100"
            max="4000"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Presets</div>
        {presets.map((preset) => (
          <Button
            key={preset.name}
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => onUpdateCanvas({ width: preset.width, height: preset.height })}
          >
            <div className="flex items-center justify-between w-full">
              <span>{preset.name}</span>
              <span className="text-muted-foreground text-xs">
                {preset.width}×{preset.height}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}