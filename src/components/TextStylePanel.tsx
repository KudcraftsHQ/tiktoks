'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { Slider } from '@/components/ui/slider' // Not available
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
  Trash2,
  Eye,
  EyeOff,
  WrapText,
  Shadow,
  BorderAll
} from 'lucide-react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

interface TextStylePanelProps {
  selectedTextBox: RemixTextBoxType
  onUpdate: (updates: Partial<RemixTextBoxType>) => void
  onDelete: () => void
}

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
  { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' }
]

export function TextStylePanel({ selectedTextBox, onUpdate, onDelete }: TextStylePanelProps) {
  const toggleBold = () => {
    const isBold = selectedTextBox.fontWeight === 'bold' ||
                   ['600', '700', '800', '900'].includes(selectedTextBox.fontWeight)
    onUpdate({ fontWeight: isBold ? 'normal' : 'bold' })
  }

  const toggleItalic = () => {
    onUpdate({
      fontStyle: selectedTextBox.fontStyle === 'italic' ? 'normal' : 'italic'
    })
  }

  const toggleUnderline = () => {
    onUpdate({
      textDecoration: selectedTextBox.textDecoration === 'underline' ? 'none' : 'underline'
    })
  }

  const setTextAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    onUpdate({ textAlign: align })
  }

  return (
    <div className="space-y-4">
      {/* Text Content */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Text Content</label>
        <Textarea
          value={selectedTextBox.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={3}
          className="resize-none"
          placeholder="Enter your text..."
        />
      </div>

      {/* Font Settings */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">Font</div>

        {/* Font Family */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Font Family</label>
          <Select
            value={selectedTextBox.fontFamily}
            onValueChange={(value) => onUpdate({ fontFamily: value })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((font) => (
                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size & Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Size</label>
            <Input
              type="number"
              min="8"
              max="200"
              value={selectedTextBox.fontSize}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Weight</label>
            <Select
              value={selectedTextBox.fontWeight}
              onValueChange={(value) => onUpdate({ fontWeight: value as any })}
            >
              <SelectTrigger className="text-sm">
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
          </div>
        </div>

        {/* Text Style Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant={
              selectedTextBox.fontWeight === 'bold' ||
              ['600', '700', '800', '900'].includes(selectedTextBox.fontWeight)
                ? 'default' : 'ghost'
            }
            size="sm"
            onClick={toggleBold}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTextBox.fontStyle === 'italic' ? 'default' : 'ghost'}
            size="sm"
            onClick={toggleItalic}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTextBox.textDecoration === 'underline' ? 'default' : 'ghost'}
            size="sm"
            onClick={toggleUnderline}
          >
            <Underline className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Text Alignment */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">Alignment</div>
        <div className="flex items-center gap-1">
          <Button
            variant={selectedTextBox.textAlign === 'left' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTextAlign('left')}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTextBox.textAlign === 'center' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTextAlign('center')}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTextBox.textAlign === 'right' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTextAlign('right')}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedTextBox.textAlign === 'justify' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTextAlign('justify')}
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Colors */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">Colors</div>

        {/* Text Color */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Text Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedTextBox.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-12 h-9 rounded-md border border-input cursor-pointer"
            />
            <Input
              type="text"
              value={selectedTextBox.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="flex-1 text-xs font-mono"
              placeholder="#ffffff"
            />
          </div>
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Background</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ backgroundColor: selectedTextBox.backgroundColor ? undefined : '#000000' })}
            >
              {selectedTextBox.backgroundColor ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
          {selectedTextBox.backgroundColor && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedTextBox.backgroundColor}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  className="w-12 h-9 rounded-md border border-input cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedTextBox.backgroundColor}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  className="flex-1 text-xs font-mono"
                  placeholder="#000000"
                />
              </div>
              {/* Background Opacity */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Opacity: {Math.round((selectedTextBox.backgroundOpacity || 1) * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(selectedTextBox.backgroundOpacity || 1) * 100}
                  onChange={(e) => onUpdate({ backgroundOpacity: parseInt(e.target.value) / 100 })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Spacing */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">Spacing</div>

        {/* Line Height */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Line Height: {(selectedTextBox.lineHeight || 1.2).toFixed(1)}
          </label>
          <input
            type="range"
            min="50"
            max="300"
            value={(selectedTextBox.lineHeight || 1.2) * 100}
            onChange={(e) => onUpdate({ lineHeight: parseInt(e.target.value) / 100 })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Letter Spacing */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Letter Spacing: {selectedTextBox.letterSpacing || 0}px
          </label>
          <input
            type="range"
            min="-5"
            max="20"
            step="0.5"
            value={selectedTextBox.letterSpacing || 0}
            onChange={(e) => onUpdate({ letterSpacing: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Border Radius */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Border Radius: {selectedTextBox.borderRadius || 0}px
          </label>
          <input
            type="range"
            min="0"
            max="50"
            value={selectedTextBox.borderRadius || 0}
            onChange={(e) => onUpdate({ borderRadius: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <Separator />

      {/* Padding */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">Padding</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Top</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={selectedTextBox.paddingTop || 8}
              onChange={(e) => onUpdate({ paddingTop: parseInt(e.target.value) })}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Right</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={selectedTextBox.paddingRight || 12}
              onChange={(e) => onUpdate({ paddingRight: parseInt(e.target.value) })}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bottom</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={selectedTextBox.paddingBottom || 8}
              onChange={(e) => onUpdate({ paddingBottom: parseInt(e.target.value) })}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Left</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={selectedTextBox.paddingLeft || 12}
              onChange={(e) => onUpdate({ paddingLeft: parseInt(e.target.value) })}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Text Wrapping */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">Text Wrapping</div>
        <div className="space-y-2">
          <Select
            value={selectedTextBox.textWrap}
            onValueChange={(value) => onUpdate({ textWrap: value as any })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Wrap</SelectItem>
              <SelectItem value="wrap">Word Wrap</SelectItem>
              <SelectItem value="ellipsis">Ellipsis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Text Shadow */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Text Shadow</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate({ enableShadow: !selectedTextBox.enableShadow })}
          >
            {selectedTextBox.enableShadow ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
        {selectedTextBox.enableShadow && (
          <div className="space-y-2">
            {/* Shadow Color */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Shadow Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedTextBox.shadowColor}
                  onChange={(e) => onUpdate({ shadowColor: e.target.value })}
                  className="w-12 h-9 rounded-md border border-input cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedTextBox.shadowColor}
                  onChange={(e) => onUpdate({ shadowColor: e.target.value })}
                  className="flex-1 text-xs font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
            {/* Shadow Blur */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Blur: {selectedTextBox.shadowBlur}px
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={selectedTextBox.shadowBlur}
                onChange={(e) => onUpdate({ shadowBlur: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            {/* Shadow Offset X */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Offset X: {selectedTextBox.shadowOffsetX}px
              </label>
              <input
                type="range"
                min="-20"
                max="20"
                value={selectedTextBox.shadowOffsetX}
                onChange={(e) => onUpdate({ shadowOffsetX: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            {/* Shadow Offset Y */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Offset Y: {selectedTextBox.shadowOffsetY}px
              </label>
              <input
                type="range"
                min="-20"
                max="20"
                value={selectedTextBox.shadowOffsetY}
                onChange={(e) => onUpdate({ shadowOffsetY: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Text Outline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Text Outline</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate({ outlineWidth: selectedTextBox.outlineWidth > 0 ? 0 : 2 })}
          >
            {selectedTextBox.outlineWidth > 0 ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
        {(selectedTextBox.outlineWidth || 0) > 0 && (
          <div className="space-y-2">
            {/* Outline Width */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Width: {selectedTextBox.outlineWidth}px
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={selectedTextBox.outlineWidth}
                onChange={(e) => onUpdate({ outlineWidth: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            {/* Outline Color */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Outline Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedTextBox.outlineColor}
                  onChange={(e) => onUpdate({ outlineColor: e.target.value })}
                  className="w-12 h-9 rounded-md border border-input cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedTextBox.outlineColor}
                  onChange={(e) => onUpdate({ outlineColor: e.target.value })}
                  className="flex-1 text-xs font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Delete Button */}
      <Button
        onClick={onDelete}
        variant="destructive"
        size="sm"
        className="w-full"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Text Box
      </Button>
    </div>
  )
}