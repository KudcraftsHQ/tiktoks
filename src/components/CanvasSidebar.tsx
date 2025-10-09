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

interface CanvasSidebarTab {
  id: string
  label: string
  icon: React.ComponentType<any>
  content: React.ReactNode
}

interface CanvasSidebarProps {
  tabs: CanvasSidebarTab[]
  className?: string
}

export function CanvasSidebar({ tabs, className }: CanvasSidebarProps) {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || '')

  const activeTab = tabs.find(tab => tab.id === activeTabId)

  return (
    <div className={cn("flex h-full border-r", className)}>
      {/* Dark vertical rail - 72px width */}
      <div className="w-[72px] bg-[#1e1e1e] flex flex-col items-center py-4 gap-2 flex-shrink-0">
        {tabs.map((tab) => {
          const IconComponent = tab.icon
          const isActive = activeTabId === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-all group relative",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white/90 hover:bg-white/5"
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
              )}
              
              <IconComponent className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Light content pane - 300px width */}
      <div className="w-[300px] bg-background overflow-y-auto flex flex-col">
        <div className="p-4 flex-1">
          {activeTab?.content}
        </div>
      </div>
    </div>
  )
}

// Legacy interface for backward compatibility (sections-based)
interface CanvasSidebarSection {
  id: string
  title: string
  icon: React.ComponentType<any>
  content: React.ReactNode
  isExpanded?: boolean
}

interface CanvasSidebarSectionsProps {
  sections: CanvasSidebarSection[]
  className?: string
}

// Wrapper component that converts sections to accordion-style display (for compatibility)
export function CanvasSidebarSections({ sections: initialSections, className }: CanvasSidebarSectionsProps) {
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
      <div className="space-y-1 p-3">
        {initialSections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const IconComponent = section.icon

          return (
            <div key={section.id} className="border border-border/40 rounded-lg overflow-hidden bg-card">
              <button
                className="w-full px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1">
                  {section.content}
                </div>
              )}
            </div>
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
    <div className="space-y-2">
      {!selectedTextBox && (
        <Button
          onClick={onAddTextBox}
          variant="outline"
          size="sm"
          className="w-full justify-start h-8"
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Text
        </Button>
      )}

      {textBoxes.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground px-0.5 py-1">
            {textBoxes.length} text {textBoxes.length === 1 ? 'element' : 'elements'}
          </div>
          {textBoxes.map((textBox, index) => (
            <div
              key={textBox.id}
              className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Type className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">
                  {textBox.text || `Text ${index + 1}`}
                </span>
              </div>
              {onDeleteTextBox && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
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
        <div className="text-center py-4 text-muted-foreground bg-muted/20 rounded border border-border/40">
          <Type className="h-5 w-5 mx-auto mb-2 opacity-40" />
          <p className="text-[11px]">Text box selected</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Use panel to edit</p>
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
    <div className="space-y-2.5">
      <Button
        onClick={onChangeBackground}
        variant="outline"
        size="sm"
        className="w-full justify-start h-8"
      >
        <ImageIcon className="h-3.5 w-3.5 mr-2" />
        {hasBackgroundImage ? 'Change Background' : 'Add Background'}
      </Button>
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
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Width</label>
          <input
            type="number"
            value={canvas.width}
            onChange={(e) => onUpdateCanvas({ width: parseInt(e.target.value) })}
            className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            min="100"
            max="4000"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Height</label>
          <input
            type="number"
            value={canvas.height}
            onChange={(e) => onUpdateCanvas({ height: parseInt(e.target.value) })}
            className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            min="100"
            max="4000"
          />
        </div>
      </div>

      <Separator className="my-2" />

      <div className="space-y-1">
        <div className="text-[11px] font-medium text-muted-foreground px-0.5 py-1">Presets</div>
        {presets.map((preset) => (
          <Button
            key={preset.name}
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => onUpdateCanvas({ width: preset.width, height: preset.height })}
          >
            <div className="flex items-center justify-between w-full">
              <span>{preset.name}</span>
              <span className="text-muted-foreground text-[10px]">
                {preset.width}×{preset.height}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}