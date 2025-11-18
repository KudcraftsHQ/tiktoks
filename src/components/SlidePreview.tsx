'use client'

import { useRef, useState, useCallback, CSSProperties, useEffect, useMemo } from 'react'
import type { SlideData, TextBox, BackgroundLayer } from '@/lib/satori-renderer'
import { generateTextHuggingBlob } from '@/lib/blob-generator'
import { measureTextWithWrapping } from '@/lib/text-measurement'

interface SlidePreviewProps {
  slideData: SlideData
  selectedTextBoxId: string | null
  selectedLayerId: string | null
  onSelectTextBox: (id: string) => void
  onSelectLayer: (id: string) => void
  onUpdateTextBox: (id: string, updates: Partial<TextBox>) => void
  onUpdateLayer: (id: string, updates: Partial<BackgroundLayer>) => void
}

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r' | 't' | 'b'

interface DragState {
  type: 'move' | 'resize' | null
  handle?: ResizeHandle
  elementId: string | null
  elementType: 'textBox' | 'layer' | null
  startX: number
  startY: number
  startElementX: number
  startElementY: number
  startElementWidth: number
  startElementHeight: number
  startFontSize?: number // For text box proportional scaling
}

export function SlidePreview({
  slideData,
  selectedTextBoxId,
  selectedLayerId,
  onSelectTextBox,
  onSelectLayer,
  onUpdateTextBox,
  onUpdateLayer,
}: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const [dragState, setDragState] = useState<DragState>({
    type: null,
    elementId: null,
    elementType: null,
    startX: 0,
    startY: 0,
    startElementX: 0,
    startElementY: 0,
    startElementWidth: 0,
    startElementHeight: 0,
  })

  const canvasWidth = slideData.canvas.width
  const canvasHeight = slideData.canvas.height
  const scaledWidth = canvasWidth * scale
  const scaledHeight = canvasHeight * scale

  const hexToRgba = (hex: string, alpha: number = 1): string => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`
    const normalized = hex.replace('#', '')
    if (normalized.length !== 6) return hex
    const num = parseInt(normalized, 16)
    const r = (num >> 16) & 255
    const g = (num >> 8) & 255
    const b = num & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const handleTextBoxClick = useCallback((
    e: React.MouseEvent,
    textBoxId: string
  ) => {
    e.stopPropagation()
    onSelectTextBox(textBoxId)
  }, [onSelectTextBox])

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    elementId: string,
    elementType: 'textBox' | 'layer',
    dragType: 'move' | 'resize',
    handle?: ResizeHandle
  ) => {
    e.stopPropagation()

    if (elementType === 'textBox') {
      onSelectTextBox(elementId)
      const textBox = slideData.textBoxes.find(tb => tb.id === elementId)
      if (textBox) {
        setDragState({
          type: dragType,
          handle,
          elementId,
          elementType,
          startX: e.clientX,
          startY: e.clientY,
          startElementX: textBox.x,
          startElementY: textBox.y,
          startElementWidth: textBox.width,
          startElementHeight: textBox.height,
          startFontSize: textBox.fontSize,
        })
      }
    } else {
      onSelectLayer(elementId)
      const layer = slideData.backgroundLayers.find(l => l.id === elementId)
      if (layer) {
        setDragState({
          type: dragType,
          handle,
          elementId,
          elementType,
          startX: e.clientX,
          startY: e.clientY,
          startElementX: layer.x,
          startElementY: layer.y,
          startElementWidth: layer.width,
          startElementHeight: layer.height,
        })
      }
    }
  }, [slideData, onSelectTextBox, onSelectLayer])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.type || !dragState.elementId) return

    const deltaX = (e.clientX - dragState.startX) / scaledWidth
    const deltaY = (e.clientY - dragState.startY) / scaledHeight

    if (dragState.type === 'move') {
      const newX = Math.max(0, Math.min(1 - dragState.startElementWidth, dragState.startElementX + deltaX))
      const newY = Math.max(0, Math.min(1 - dragState.startElementHeight, dragState.startElementY + deltaY))

      if (dragState.elementType === 'textBox') {
        onUpdateTextBox(dragState.elementId, { x: newX, y: newY })
      } else {
        onUpdateLayer(dragState.elementId, { x: newX, y: newY })
      }
    } else if (dragState.type === 'resize' && dragState.handle) {
      const handle = dragState.handle
      let newX = dragState.startElementX
      let newY = dragState.startElementY
      let newWidth = dragState.startElementWidth
      let newHeight = dragState.startElementHeight

      // Corner handles - proportional resize
      if (handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br') {
        if (dragState.elementType === 'textBox' && dragState.startFontSize) {
          // For text boxes: scale width and fontSize proportionally
          // Height will be auto-calculated by SlideEditor

          // Calculate new width and position based on which corner is being dragged
          if (handle === 'br') {
            // Bottom-right: anchor at top-left
            newWidth = Math.max(0.1, dragState.startElementWidth + deltaX)
            // Keep top-left position fixed
            newX = dragState.startElementX
            newY = dragState.startElementY
          } else if (handle === 'bl') {
            // Bottom-left: anchor at top-right
            const widthChange = -deltaX
            newWidth = Math.max(0.1, dragState.startElementWidth + widthChange)
            newX = dragState.startElementX + dragState.startElementWidth - newWidth
            newY = dragState.startElementY // Keep top fixed
          } else if (handle === 'tr') {
            // Top-right: anchor at bottom-left
            newWidth = Math.max(0.1, dragState.startElementWidth + deltaX)
            newX = dragState.startElementX // Keep left fixed
            // Calculate new height first to determine Y position
            const widthScale = newWidth / dragState.startElementWidth
            const newFontSize = Math.round(dragState.startFontSize * widthScale)

            // Estimate new height (lines * fontSize * lineHeight + padding)
            const textBox = slideData.textBoxes.find(tb => tb.id === dragState.elementId)
            if (textBox) {
              const lines = textBox.text.split('\n').length
              const lineHeight = textBox.lineHeight ?? 1.2
              const paddingTop = textBox.paddingTop ?? 20
              const paddingBottom = textBox.paddingBottom ?? 20
              const textHeight = lines * newFontSize * lineHeight
              const totalHeight = (textHeight + paddingTop + paddingBottom) / slideData.canvas.height

              // Anchor at bottom-left: adjust Y so bottom stays fixed
              newY = dragState.startElementY + dragState.startElementHeight - totalHeight
            }
          } else if (handle === 'tl') {
            // Top-left: anchor at bottom-right
            const widthChange = -deltaX
            newWidth = Math.max(0.1, dragState.startElementWidth + widthChange)
            newX = dragState.startElementX + dragState.startElementWidth - newWidth

            // Calculate new height to determine Y position
            const widthScale = newWidth / dragState.startElementWidth
            const newFontSize = Math.round(dragState.startFontSize * widthScale)

            const textBox = slideData.textBoxes.find(tb => tb.id === dragState.elementId)
            if (textBox) {
              const lines = textBox.text.split('\n').length
              const lineHeight = textBox.lineHeight ?? 1.2
              const paddingTop = textBox.paddingTop ?? 20
              const paddingBottom = textBox.paddingBottom ?? 20
              const textHeight = lines * newFontSize * lineHeight
              const totalHeight = (textHeight + paddingTop + paddingBottom) / slideData.canvas.height

              // Anchor at bottom-right: adjust Y so bottom stays fixed
              newY = dragState.startElementY + dragState.startElementHeight - totalHeight
            }
          }

          // Calculate new fontSize based on width scale
          const widthScale = newWidth / dragState.startElementWidth
          const newFontSize = Math.round(dragState.startFontSize * widthScale)

          // Clamp values
          newX = Math.max(0, Math.min(1 - newWidth, newX))
          newWidth = Math.min(1 - newX, newWidth)

          // Update with new fontSize (height will be auto-calculated)
          onUpdateTextBox(dragState.elementId, {
            x: newX,
            y: newY,
            width: newWidth,
            fontSize: newFontSize
          })
          return
        } else {
          // For layers: maintain aspect ratio
          const aspectRatio = dragState.startElementWidth / dragState.startElementHeight

          if (handle === 'br') {
            newWidth = Math.max(0.1, dragState.startElementWidth + deltaX)
            newHeight = newWidth / aspectRatio
          } else if (handle === 'bl') {
            const widthChange = -deltaX
            newWidth = Math.max(0.1, dragState.startElementWidth + widthChange)
            newHeight = newWidth / aspectRatio
            newX = dragState.startElementX - widthChange
          } else if (handle === 'tr') {
            const heightChange = -deltaY
            newHeight = Math.max(0.05, dragState.startElementHeight + heightChange)
            newWidth = newHeight * aspectRatio
            newY = dragState.startElementY - heightChange
          } else if (handle === 'tl') {
            const widthChange = -deltaX
            newWidth = Math.max(0.1, dragState.startElementWidth + widthChange)
            newHeight = newWidth / aspectRatio
            newX = dragState.startElementX - widthChange
            newY = dragState.startElementY + (dragState.startElementHeight - newHeight)
          }
        }
      }
      // Side handles - width only (for text boxes)
      else if (dragState.elementType === 'textBox') {
        if (handle === 'l') {
          const widthChange = -deltaX
          newWidth = Math.max(0.1, dragState.startElementWidth + widthChange)
          newX = dragState.startElementX - widthChange
        } else if (handle === 'r') {
          newWidth = Math.max(0.1, dragState.startElementWidth + deltaX)
        }
      }

      // Clamp values
      newX = Math.max(0, Math.min(1 - newWidth, newX))
      newY = Math.max(0, Math.min(1 - newHeight, newY))
      newWidth = Math.min(1 - newX, newWidth)
      newHeight = Math.min(1 - newY, newHeight)

      if (dragState.elementType === 'textBox') {
        // For side handles, only update position and width (height auto-calculated)
        onUpdateTextBox(dragState.elementId, { x: newX, y: newY, width: newWidth })
      } else {
        onUpdateLayer(dragState.elementId, { x: newX, y: newY, width: newWidth, height: newHeight })
      }
    }
  }, [dragState, scaledWidth, scaledHeight, onUpdateTextBox, onUpdateLayer])

  const handleMouseUp = useCallback(() => {
    setDragState({
      type: null,
      elementId: null,
      elementType: null,
      startX: 0,
      startY: 0,
      startElementX: 0,
      startElementY: 0,
      startElementWidth: 0,
      startElementHeight: 0,
    })
  }, [])

  useEffect(() => {
    if (dragState.type) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState.type, handleMouseMove, handleMouseUp])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking on the canvas background
    if (e.target === e.currentTarget) {
      onSelectTextBox('')
      onSelectLayer('')
    }
  }, [onSelectTextBox, onSelectLayer])

  const canvasStyle: CSSProperties = {
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    position: 'relative',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    borderRadius: '8px',
    overflow: 'hidden',
  }

  return (
    <div ref={containerRef} style={canvasStyle} onClick={handleCanvasClick}>
      {/* Background Layers */}
      {slideData.backgroundLayers.sort((a, b) => a.zIndex - b.zIndex).map((layer) => {
        const layerStyle: CSSProperties = {
          position: 'absolute',
          left: `${layer.x * 100}%`,
          top: `${layer.y * 100}%`,
          width: `${layer.width * 100}%`,
          height: `${layer.height * 100}%`,
          opacity: layer.opacity,
          cursor: selectedLayerId === layer.id ? 'move' : 'pointer',
        }

        if (layer.type === 'color' && layer.color) {
          layerStyle.backgroundColor = layer.color
        } else if (layer.type === 'gradient' && layer.gradient) {
          const { type, colors, angle = 0 } = layer.gradient
          if (type === 'linear') {
            layerStyle.backgroundImage = `linear-gradient(${angle}deg, ${colors.join(', ')})`
          } else {
            layerStyle.backgroundImage = `radial-gradient(circle, ${colors.join(', ')})`
          }
        }

        return (
          <div key={layer.id}>
            <div
              style={layerStyle}
              onMouseDown={(e) => handleMouseDown(e, layer.id, 'layer', 'move')}
            >
              {layer.type === 'image' && layer.imageUrl && (
                <img
                  src={layer.imageUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>

            {/* Layer Handlers - only corner handles for proportional resize */}
            {selectedLayerId === layer.id && (
              <>
                {/* Selection Border */}
                <div style={{
                  position: 'absolute',
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  width: `${layer.width * 100}%`,
                  height: `${layer.height * 100}%`,
                  border: '2px solid #3b82f6',
                  pointerEvents: 'none',
                }} />

                {/* Corner Handles - square boxes */}
                {(['tl', 'tr', 'bl', 'br'] as ResizeHandle[]).map((handle) => {
                  const handlePos: Record<ResizeHandle, CSSProperties> = {
                    tl: { left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, cursor: 'nwse-resize' },
                    tr: { left: `${(layer.x + layer.width) * 100}%`, top: `${layer.y * 100}%`, cursor: 'nesw-resize' },
                    bl: { left: `${layer.x * 100}%`, top: `${(layer.y + layer.height) * 100}%`, cursor: 'nesw-resize' },
                    br: { left: `${(layer.x + layer.width) * 100}%`, top: `${(layer.y + layer.height) * 100}%`, cursor: 'nwse-resize' },
                    l: { left: '0', top: '0', cursor: 'ew-resize' },
                    r: { left: '0', top: '0', cursor: 'ew-resize' },
                    t: { left: '0', top: '0', cursor: 'ns-resize' },
                    b: { left: '0', top: '0', cursor: 'ns-resize' },
                  }

                  return (
                    <div
                      key={handle}
                      style={{
                        position: 'absolute',
                        ...handlePos[handle],
                        width: '8px',
                        height: '8px',
                        backgroundColor: 'white',
                        border: '1px solid #3b82f6',
                        borderRadius: '1px',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleMouseDown(e, layer.id, 'layer', 'resize', handle)
                      }}
                    />
                  )
                })}
              </>
            )}
          </div>
        )
      })}

      {/* Text Boxes */}
      {slideData.textBoxes.sort((a, b) => a.zIndex - b.zIndex).map((textBox) => {
        const boxX = textBox.x * 100
        const boxY = textBox.y * 100
        const boxWidth = textBox.width * 100
        const boxHeight = textBox.height * 100

        const containerStyle: CSSProperties = {
          position: 'absolute',
          left: `${boxX}%`,
          top: `${boxY}%`,
          width: `${boxWidth}%`,
          height: `${boxHeight}%`,
          cursor: selectedTextBoxId === textBox.id ? 'move' : 'pointer',
        }

        const textStyle: CSSProperties = {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: textBox.textAlign === 'center' ? 'center' : textBox.textAlign === 'right' ? 'flex-end' : 'flex-start',
          fontFamily: textBox.fontFamily,
          fontSize: `${textBox.fontSize * scale}px`,
          fontWeight: textBox.fontWeight,
          fontStyle: textBox.fontStyle,
          color: textBox.color,
          textAlign: textBox.textAlign,
          padding: `${(textBox.paddingTop ?? 16) * scale}px ${(textBox.paddingRight ?? 20) * scale}px ${(textBox.paddingBottom ?? 16) * scale}px ${(textBox.paddingLeft ?? 20) * scale}px`,
          lineHeight: textBox.lineHeight ?? 1.2,
          letterSpacing: textBox.letterSpacing ? `${textBox.letterSpacing * scale}px` : undefined,
          boxShadow: textBox.enableShadow
            ? `${(textBox.shadowOffsetX ?? 2) * scale}px ${(textBox.shadowOffsetY ?? 2) * scale}px ${(textBox.shadowBlur ?? 4) * scale}px ${textBox.shadowColor || 'rgba(0, 0, 0, 0.3)'}`
            : undefined,
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          userSelect: 'none',
          pointerEvents: 'none',
        }

        return (
          <div key={textBox.id}>
            <div
              style={containerStyle}
              onClick={(e) => handleTextBoxClick(e, textBox.id)}
              onMouseDown={(e) => handleMouseDown(e, textBox.id, 'textBox', 'move')}
            >
              {/* Blob Background */}
              {textBox.enableBlobBackground && (() => {
                // Calculate available width for text (excluding padding)
                const paddingLeft = (textBox.paddingLeft ?? 20) * scale
                const paddingRight = (textBox.paddingRight ?? 20) * scale
                // Convert normalized width (0-1) to pixels
                const containerWidthPx = textBox.width * scaledWidth
                const availableWidth = containerWidthPx - paddingLeft - paddingRight

                // Measure text lines with wrapping based on available width
                const lines = measureTextWithWrapping({
                  text: textBox.text,
                  fontSize: textBox.fontSize * scale,
                  fontFamily: textBox.fontFamily,
                  fontWeight: textBox.fontWeight,
                  fontStyle: textBox.fontStyle,
                  lineHeight: textBox.lineHeight,
                  maxWidth: availableWidth,
                })

                const blobSpread = (textBox.blobSpread ?? 20) * scale
                const lineHeight = textBox.fontSize * scale * (textBox.lineHeight ?? 1.2)

                // Generate TikTok-style blob path (stable rounded rectangles)
                const blobPath = generateTextHuggingBlob({
                  lines,
                  lineHeight,
                  spread: blobSpread,
                  roundness: textBox.blobRoundness ?? 0.5,
                })

                // Calculate blob dimensions
                const maxLineWidth = Math.max(...lines.map((l) => l.width), 0)
                const totalHeight = lines.length * lineHeight
                const blobWidth = maxLineWidth + blobSpread * 2
                const blobHeight = totalHeight + blobSpread * 2

                return (
                  <svg
                    viewBox={`${-blobSpread} ${-blobSpread} ${blobWidth} ${blobHeight}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: `${blobWidth}px`,
                      height: `${blobHeight}px`,
                      opacity: textBox.blobOpacity ?? 1,
                      zIndex: 0,
                      pointerEvents: 'none',
                    }}
                  >
                    <path fill={textBox.blobColor || '#ffffff'} d={blobPath} />
                  </svg>
                )
              })()}

              {/* Text */}
              <div style={textStyle}>
                {textBox.text}
              </div>
            </div>

            {/* Text Box Handlers */}
            {selectedTextBoxId === textBox.id && (
              <>
                {/* Selection Border */}
                <div style={{
                  position: 'absolute',
                  left: `${boxX}%`,
                  top: `${boxY}%`,
                  width: `${boxWidth}%`,
                  height: `${boxHeight}%`,
                  border: '2px solid #8b5cf6',
                  pointerEvents: 'none',
                }} />

                {/* Corner Handles - square boxes */}
                {(['tl', 'tr', 'bl', 'br'] as ResizeHandle[]).map((handle) => {
                  const handlePos: Record<ResizeHandle, CSSProperties> = {
                    tl: { left: `${boxX}%`, top: `${boxY}%`, cursor: 'nwse-resize' },
                    tr: { left: `${boxX + boxWidth}%`, top: `${boxY}%`, cursor: 'nesw-resize' },
                    bl: { left: `${boxX}%`, top: `${boxY + boxHeight}%`, cursor: 'nesw-resize' },
                    br: { left: `${boxX + boxWidth}%`, top: `${boxY + boxHeight}%`, cursor: 'nwse-resize' },
                    l: { left: '0', top: '0', cursor: 'ew-resize' },
                    r: { left: '0', top: '0', cursor: 'ew-resize' },
                    t: { left: '0', top: '0', cursor: 'ns-resize' },
                    b: { left: '0', top: '0', cursor: 'ns-resize' },
                  }

                  return (
                    <div
                      key={handle}
                      style={{
                        position: 'absolute',
                        ...handlePos[handle],
                        width: '8px',
                        height: '8px',
                        backgroundColor: 'white',
                        border: '1px solid #8b5cf6',
                        borderRadius: '1px',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleMouseDown(e, textBox.id, 'textBox', 'resize', handle)
                      }}
                    />
                  )
                })}

                {/* Side Handles - width adjustment only */}
                {(['l', 'r'] as ResizeHandle[]).map((handle) => {
                  const handleHeightPercent = 10 // 10% of box height

                  return (
                    <div
                      key={handle}
                      style={{
                        position: 'absolute',
                        left: handle === 'l' ? `${boxX}%` : `${boxX + boxWidth}%`,
                        top: `${boxY + (boxHeight * (50 - handleHeightPercent / 2) / 100)}%`,
                        width: '4px',
                        height: `${boxHeight * handleHeightPercent / 100}%`,
                        backgroundColor: 'white',
                        border: '1px solid #8b5cf6',
                        borderRadius: '1px',
                        transform: 'translateX(-50%)',
                        cursor: 'ew-resize',
                        zIndex: 1000,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleMouseDown(e, textBox.id, 'textBox', 'resize', handle)
                      }}
                    />
                  )
                })}
              </>
            )}
          </div>
        )
      })}

      {/* Scale Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-black/70 px-3 py-2 rounded-md">
        <button
          onClick={() => setScale(Math.max(0.2, scale - 0.1))}
          className="px-2 py-1 bg-white text-black rounded text-xs hover:bg-gray-200 transition-colors"
        >
          -
        </button>
        <span className="text-white text-xs flex items-center px-2">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(Math.min(1, scale + 0.1))}
          className="px-2 py-1 bg-white text-black rounded text-xs hover:bg-gray-200 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}
