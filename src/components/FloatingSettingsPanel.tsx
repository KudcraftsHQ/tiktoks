'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Hash,
  Square,
  Settings
} from 'lucide-react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
  'Courier New',
  'Poppins',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Source Sans Pro',
  'Oswald',
  'Raleway',
  'PT Sans'
]

const FONT_WEIGHTS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'XLight' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'SemiBold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'XBold' },
  { value: '900', label: 'Black' }
]

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
        className="bg-background rounded-lg shadow-lg border border-white/20 p-2 flex items-center gap-1 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
      {/* Font Family */}
      <Select
        value={selectedTextBox.fontFamily}
        onValueChange={(value) => onUpdateTextBox({ fontFamily: value })}
      >
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((font) => (
            <SelectItem key={font} value={font}>
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6" />

      {/* Font Weight */}
      <Select
        value={selectedTextBox.fontWeight}
        onValueChange={(value) => onUpdateTextBox({ fontWeight: value as any })}
      >
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_WEIGHTS.map((weight) => (
            <SelectItem key={weight.value} value={weight.value}>
              {weight.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6" />

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
          variant={selectedTextBox.fontStyle === 'italic' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleItalic}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textDecoration === 'underline' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleUnderline}
          title="Underline"
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
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textAlign === 'center' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('center')}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textAlign === 'right' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('right')}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={selectedTextBox.textAlign === 'justify' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setTextAlign('justify')}
          title="Align Justify"
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
        <span className="text-xs text-gray-500">BG</span>
        <input
          type="color"
          value={selectedTextBox.backgroundColor || '#ffffff'}
          onChange={(e) => onUpdateTextBox({ backgroundColor: e.target.value })}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          title="Background Color"
        />
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Shadow */}
      <Button
        variant={selectedTextBox.enableShadow ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onUpdateTextBox({ enableShadow: !selectedTextBox.enableShadow })}
        title="Text Shadow"
      >
        <Hash className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Text Outline */}
      <Button
        variant={(selectedTextBox.outlineWidth || 0) > 0 ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onUpdateTextBox({ outlineWidth: (selectedTextBox.outlineWidth || 0) > 0 ? 0 : 2 })}
        title="Text Outline"
      >
        <Square className="h-4 w-4" />
      </Button>

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
          minWidth: '350px'
        }}
        className="bg-background rounded-lg shadow-lg border border-white/20 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          {/* Line Height */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Line Height</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={selectedTextBox.lineHeight || 1.2}
                onChange={(e) => onUpdateTextBox({ lineHeight: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <Input
                type="number"
                min="0.5"
                max="3"
                step="0.1"
                value={selectedTextBox.lineHeight || 1.2}
                onChange={(e) => onUpdateTextBox({ lineHeight: parseFloat(e.target.value) })}
                className="w-16 h-8 text-xs"
              />
            </div>
          </div>

          {/* Letter Spacing */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Letter Spacing</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-5"
                max="20"
                step="0.5"
                value={selectedTextBox.letterSpacing || 0}
                onChange={(e) => onUpdateTextBox({ letterSpacing: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <Input
                type="number"
                min="-5"
                max="20"
                step="0.5"
                value={selectedTextBox.letterSpacing || 0}
                onChange={(e) => onUpdateTextBox({ letterSpacing: parseFloat(e.target.value) })}
                className="w-16 h-8 text-xs"
              />
            </div>
          </div>

          {/* Word Spacing */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Word Spacing</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-10"
                max="50"
                step="1"
                value={(selectedTextBox as any).wordSpacing || 0}
                onChange={(e) => onUpdateTextBox({ wordSpacing: parseFloat(e.target.value) } as any)}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <Input
                type="number"
                min="-10"
                max="50"
                step="1"
                value={(selectedTextBox as any).wordSpacing || 0}
                onChange={(e) => onUpdateTextBox({ wordSpacing: parseFloat(e.target.value) } as any)}
                className="w-16 h-8 text-xs"
              />
            </div>
          </div>

          {/* Quick Shadow Controls */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Shadow Blur</div>
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
              <Input
                type="number"
                min="0"
                max="10"
                value={selectedTextBox.shadowBlur}
                onChange={(e) => onUpdateTextBox({ shadowBlur: parseInt(e.target.value), enableShadow: true })}
                className="w-16 h-8 text-xs"
              />
            </div>
          </div>

          {/* Quick Outline Controls */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Outline Width</div>
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
              <Input
                type="number"
                min="0"
                max="5"
                step="0.5"
                value={selectedTextBox.outlineWidth}
                onChange={(e) => onUpdateTextBox({ outlineWidth: parseFloat(e.target.value) })}
                className="w-16 h-8 text-xs"
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

          {/* Background Border Radius */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Background Border Radius</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={selectedTextBox.borderRadius || 0}
                onChange={(e) => onUpdateTextBox({ borderRadius: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <Input
                type="number"
                min="0"
                max="50"
                step="1"
                value={selectedTextBox.borderRadius || 0}
                onChange={(e) => onUpdateTextBox({ borderRadius: parseInt(e.target.value) })}
                className="w-16 h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}