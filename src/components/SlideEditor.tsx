'use client'

import { useState, useRef, useCallback } from 'react'
import type { SlideData, TextBox, BackgroundLayer } from '@/lib/satori-renderer'
import { SlidePreview } from './SlidePreview'
import { TextEffectsPanel } from './TextEffectsPanel'
import { BackgroundPanel } from './BackgroundPanel'

interface SlideEditorProps {
  slideData: SlideData
  onSlideDataChange: (data: SlideData) => void
}

export function SlideEditor({ slideData, onSlideDataChange }: SlideEditorProps) {
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)

  const selectedTextBox = slideData.textBoxes.find(tb => tb.id === selectedTextBoxId)
  const selectedLayer = slideData.backgroundLayers.find(l => l.id === selectedLayerId)

  // Calculate auto height for text box based on content
  const calculateTextBoxHeight = useCallback((textBox: TextBox) => {
    const lines = textBox.text.split('\n').length
    const lineHeight = textBox.lineHeight ?? 1.2
    const fontSize = textBox.fontSize
    const paddingTop = textBox.paddingTop ?? 20
    const paddingBottom = textBox.paddingBottom ?? 20

    // Calculate text height in pixels
    const textHeight = lines * fontSize * lineHeight
    const totalHeight = textHeight + paddingTop + paddingBottom

    // Convert to normalized height (0-1) based on canvas height
    const canvasHeight = slideData.canvas.height
    return totalHeight / canvasHeight
  }, [slideData.canvas.height])

  // Update text box
  const updateTextBox = useCallback((id: string, updates: Partial<TextBox>) => {
    const currentTextBox = slideData.textBoxes.find(tb => tb.id === id)
    if (!currentTextBox) return

    // Create updated text box
    const updatedTextBox = { ...currentTextBox, ...updates }

    // Auto-adjust height if text, fontSize, lineHeight, or padding changed
    if (updates.text !== undefined ||
        updates.fontSize !== undefined ||
        updates.lineHeight !== undefined ||
        updates.paddingTop !== undefined ||
        updates.paddingBottom !== undefined) {
      updatedTextBox.height = calculateTextBoxHeight(updatedTextBox)
    }

    onSlideDataChange({
      ...slideData,
      textBoxes: slideData.textBoxes.map(tb =>
        tb.id === id ? updatedTextBox : tb
      ),
    })
  }, [slideData, onSlideDataChange, calculateTextBoxHeight])

  // Update background layer
  const updateBackgroundLayer = useCallback((id: string, updates: Partial<BackgroundLayer>) => {
    onSlideDataChange({
      ...slideData,
      backgroundLayers: slideData.backgroundLayers.map(l =>
        l.id === id ? { ...l, ...updates } : l
      ),
    })
  }, [slideData, onSlideDataChange])

  // Add new text box
  const addTextBox = useCallback(() => {
    const newTextBox: TextBox = {
      id: `text-${Date.now()}`,
      text: 'New Text',
      x: 0.2,
      y: 0.4,
      width: 0.6,
      height: 0.15, // Will be recalculated below
      fontSize: 48,
      fontFamily: 'Poppins',
      fontWeight: 600,
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#ffffff',
      textAlign: 'center',
      zIndex: 10 + slideData.textBoxes.length,
      enableBlobBackground: false,
      paddingTop: 20,
      paddingRight: 28,
      paddingBottom: 20,
      paddingLeft: 28,
      lineHeight: 1.2,
    }

    // Auto-calculate correct height
    newTextBox.height = calculateTextBoxHeight(newTextBox)

    onSlideDataChange({
      ...slideData,
      textBoxes: [...slideData.textBoxes, newTextBox],
    })

    setSelectedTextBoxId(newTextBox.id)
  }, [slideData, onSlideDataChange, calculateTextBoxHeight])

  return (
    <div className="flex h-full gap-0">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-card border-r overflow-y-auto flex flex-col">
        {/* Background Panel */}
        <BackgroundPanel
          layers={slideData.backgroundLayers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onUpdateLayer={updateBackgroundLayer}
        />

        {/* Text Box Controls */}
        <div className="border-t p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Text Boxes</h3>
            <button
              onClick={addTextBox}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              + Add Text
            </button>
          </div>

          {/* Text Box List */}
          <div className="flex flex-col gap-2 mb-4">
            {slideData.textBoxes.map(textBox => (
              <div
                key={textBox.id}
                onClick={() => setSelectedTextBoxId(textBox.id)}
                className={`p-3 rounded-md cursor-pointer text-sm border transition-colors ${
                  selectedTextBoxId === textBox.id
                    ? 'bg-accent border-primary'
                    : 'bg-muted hover:bg-accent border-border'
                }`}
              >
                <div className="font-medium mb-1">
                  {textBox.text.substring(0, 30)}{textBox.text.length > 30 ? '...' : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  {textBox.fontFamily} {textBox.fontWeight} • {textBox.fontSize}px
                </div>
              </div>
            ))}
          </div>

          {/* Text Effects Panel */}
          {selectedTextBox && (
            <TextEffectsPanel
              textBox={selectedTextBox}
              onUpdate={(updates) => updateTextBox(selectedTextBox.id, updates)}
            />
          )}
        </div>
      </div>

      {/* Center - Canvas Preview */}
      <div className="flex-1 flex justify-center items-center p-6 bg-background">
        <SlidePreview
          slideData={slideData}
          selectedTextBoxId={selectedTextBoxId}
          selectedLayerId={selectedLayerId}
          onSelectTextBox={setSelectedTextBoxId}
          onSelectLayer={setSelectedLayerId}
          onUpdateTextBox={updateTextBox}
          onUpdateLayer={updateBackgroundLayer}
        />
      </div>
    </div>
  )
}
