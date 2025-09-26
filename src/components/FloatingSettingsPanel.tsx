'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Type,
  Palette,
  Move,
  MoreHorizontal,
  WrapText,
  Hash,
  Square,
  Settings
} from 'lucide-react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

interface FloatingSettingsPanelProps {
  selectedTextBox: RemixTextBoxType | null
  onUpdateTextBox: (updates: Partial<RemixTextBoxType>) => void
  position: { x: number; y: number }
  canvasZoom: number
}

export function FloatingSettingsPanel({
  selectedTextBox,
  onUpdateTextBox,
  position,
  canvasZoom
}: FloatingSettingsPanelProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  if (!selectedTextBox) return null

  const panelStyle = {
    position: 'absolute',
    top: '20px', // Top of the canvas area
    left: '50%',
    transform: 'translateX(-50%)', // Center horizontally within canvas
    zIndex: 10000
  }

  const toggleBold = () => {
    const isBold = selectedTextBox.fontWeight === 'bold' ||
                   ['600', '700', '800', '900'].includes(selectedTextBox.fontWeight)
    onUpdateTextBox({ fontWeight: isBold ? 'normal' : 'bold' })
  }

  const toggleItalic = () => {
    onUpdateTextBox({
      fontStyle: selectedTextBox.fontStyle === 'italic' ? 'normal' : 'italic'
    })
  }

  const toggleUnderline = () => {
    onUpdateTextBox({
      textDecoration: selectedTextBox.textDecoration === 'underline' ? 'none' : 'underline'
    })
  }

  const setTextAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    onUpdateTextBox({ textAlign: align })
  }

  return (
    <>
      <div
        style={panelStyle as any}
        className="bg-background rounded-lg shadow-lg p-2 flex items-center gap-1 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
      {/* Font Size */}
      <div className="flex items-center gap-1">
        <Type className="h-4 w-4 text-gray-500" />
        <Input
          type="number"
          min="8"
          max="200"
          value={selectedTextBox.fontSize}
          onChange={(e) => onUpdateTextBox({ fontSize: parseInt(e.target.value) })}
          className="w-16 h-8 text-xs"
        />
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Formatting */}
      <div className="flex items-center gap-1">
        <Button
          variant={
            selectedTextBox.fontWeight === 'bold' ||
            ['600', '700', '800', '900'].includes(selectedTextBox.fontWeight)
              ? 'default' : 'ghost'
          }
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleBold}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.fontStyle === 'italic' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleItalic}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textDecoration === 'underline' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleUnderline}
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Alignment */}
      <div className="flex items-center gap-1">
        <Button
          variant={selectedTextBox.textAlign === 'left' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('left')}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textAlign === 'center' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('center')}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textAlign === 'right' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('right')}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textAlign === 'justify' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('justify')}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Color */}
      <div className="flex items-center gap-1">
        <Palette className="h-4 w-4 text-gray-500" />
        <input
          type="color"
          value={selectedTextBox.color}
          onChange={(e) => onUpdateTextBox({ color: e.target.value })}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          title="Text Color"
        />
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Background Color */}
      <div className="flex items-center gap-1">
        <div className="text-xs text-gray-500">BG</div>
        <input
          type="color"
          value={selectedTextBox.backgroundColor || '#ffffff'}
          onChange={(e) => onUpdateTextBox({ backgroundColor: e.target.value })}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          title="Background Color"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-xs"
          onClick={() => onUpdateTextBox({ backgroundColor: undefined })}
          title="Remove Background"
        >
          ×
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Wrapping */}
      <div className="flex items-center gap-1">
        <Button
          variant={selectedTextBox.textWrap !== 'none' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onUpdateTextBox({ textWrap: selectedTextBox.textWrap === 'none' ? 'wrap' : 'none' })}
          title="Text Wrapping"
        >
          <WrapText className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Shadow */}
      <div className="flex items-center gap-1">
        <Button
          variant={selectedTextBox.enableShadow ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onUpdateTextBox({ enableShadow: !selectedTextBox.enableShadow })}
          title="Text Shadow"
        >
          <Hash className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Outline */}
      <div className="flex items-center gap-1">
        <Button
          variant={(selectedTextBox.outlineWidth || 0) > 0 ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onUpdateTextBox({ outlineWidth: (selectedTextBox.outlineWidth || 0) > 0 ? 0 : 2 })}
          title="Text Outline"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Advanced Settings */}
      <Button
        variant={showAdvanced ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setShowAdvanced(!showAdvanced)}
        title="Advanced Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>

    {/* Advanced Settings Panel */}
    {showAdvanced && (
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          minWidth: '300px'
        }}
        className="bg-background rounded-lg shadow-lg p-4 border"
      >
        <div className="space-y-4">
          {/* Quick Shadow Controls */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Quick Shadow</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedTextBox.shadowColor}
                onChange={(e) => onUpdateTextBox({ shadowColor: e.target.value, enableShadow: true })}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                title="Shadow Color"
              />
              <input
                type="range"
                min="0"
                max="10"
                value={selectedTextBox.shadowBlur}
                onChange={(e) => onUpdateTextBox({ shadowBlur: parseInt(e.target.value), enableShadow: true })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Outline Controls */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Quick Outline</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedTextBox.outlineColor}
                onChange={(e) => onUpdateTextBox({ outlineColor: e.target.value, outlineWidth: 2 })}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                title="Outline Color"
              />
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={selectedTextBox.outlineWidth}
                onChange={(e) => onUpdateTextBox({ outlineWidth: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Text Wrap Options */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Text Wrap</div>
            <div className="flex gap-1">
              <Button
                variant={selectedTextBox.textWrap === 'none' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-6"
                onClick={() => onUpdateTextBox({ textWrap: 'none' })}
              >
                None
              </Button>
              <Button
                variant={selectedTextBox.textWrap === 'wrap' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-6"
                onClick={() => onUpdateTextBox({ textWrap: 'wrap' })}
              >
                Wrap
              </Button>
              <Button
                variant={selectedTextBox.textWrap === 'ellipsis' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-6"
                onClick={() => onUpdateTextBox({ textWrap: 'ellipsis' })}
              >
                Ellipsis
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}