/**
 * Satori Renderer
 * Generates JSX with inline styles for Satori rendering
 */

import { generateTextHuggingBlob } from './blob-generator'
import { estimateTextMeasurements } from './text-measurement-server'
import type React from 'react'

export interface BackgroundLayer {
  id: string
  type: 'image' | 'color' | 'gradient'
  imageUrl?: string
  color?: string
  gradient?: {
    type: 'linear' | 'radial'
    colors: string[]
    angle?: number
  }
  x: number
  y: number
  width: number
  height: number
  opacity: number
  zIndex: number
}

export interface TextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string | number
  fontStyle: 'normal' | 'italic'
  textDecoration: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  zIndex: number

  // Text effects
  enableShadow?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number

  outlineWidth?: number
  outlineColor?: string

  // Blob background (only background option)
  enableBlobBackground?: boolean
  blobColor?: string
  blobOpacity?: number
  blobSpread?: number // Padding around text in pixels
  blobRoundness?: number // 0-1, 0 = sharp corners, 1 = very smooth

  // Padding
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number

  // Typography
  lineHeight?: number
  letterSpacing?: number

  // Transform
  transform?: {
    rotation?: number
  }
}

export interface SlideData {
  canvas: {
    width: number
    height: number
  }
  backgroundLayers: BackgroundLayer[]
  textBoxes: TextBox[]
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`

  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex

  const num = parseInt(normalized, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Render a background layer
 */
function renderBackgroundLayer(layer: BackgroundLayer, canvasWidth: number, canvasHeight: number): React.ReactElement {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${layer.x * canvasWidth}px`,
    top: `${layer.y * canvasHeight}px`,
    width: `${layer.width * canvasWidth}px`,
    height: `${layer.height * canvasHeight}px`,
    opacity: layer.opacity,
    display: 'flex',
  }

  if (layer.type === 'color' && layer.color) {
    style.backgroundColor = layer.color
  } else if (layer.type === 'gradient' && layer.gradient) {
    const { type, colors, angle = 0 } = layer.gradient

    if (type === 'linear') {
      const colorStops = colors.join(', ')
      style.backgroundImage = `linear-gradient(${angle}deg, ${colorStops})`
    } else {
      const colorStops = colors.join(', ')
      style.backgroundImage = `radial-gradient(circle, ${colorStops})`
    }
  } else if (layer.type === 'image' && layer.imageUrl) {
    // For images, use img tag instead of backgroundImage
    return (
      <div key={layer.id} style={style}>
        <img
          src={layer.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          alt=""
        />
      </div>
    )
  }

  return <div key={layer.id} style={style} />
}

/**
 * Render a text box with optional blob background
 */
function renderTextBox(textBox: TextBox, canvasWidth: number, canvasHeight: number): React.ReactElement {
  const boxX = textBox.x * canvasWidth
  const boxY = textBox.y * canvasHeight
  const boxWidth = textBox.width * canvasWidth
  const boxHeight = textBox.height * canvasHeight

  const paddingTop = textBox.paddingTop ?? 16
  const paddingRight = textBox.paddingRight ?? 20
  const paddingBottom = textBox.paddingBottom ?? 16
  const paddingLeft = textBox.paddingLeft ?? 20

  // Container style
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${boxX}px`,
    top: `${boxY}px`,
    width: `${boxWidth}px`,
    height: `${boxHeight}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: textBox.textAlign === 'center' ? 'center' : textBox.textAlign === 'right' ? 'flex-end' : 'flex-start',
  }

  // Text style
  const textStyle: React.CSSProperties = {
    fontFamily: textBox.fontFamily,
    fontSize: `${textBox.fontSize}px`,
    fontWeight: textBox.fontWeight,
    fontStyle: textBox.fontStyle,
    color: textBox.color,
    textAlign: textBox.textAlign,
    textDecoration: textBox.textDecoration,
    lineHeight: textBox.lineHeight ?? 1.2,
    letterSpacing: textBox.letterSpacing ? `${textBox.letterSpacing}px` : undefined,
    paddingTop: `${paddingTop}px`,
    paddingRight: `${paddingRight}px`,
    paddingBottom: `${paddingBottom}px`,
    paddingLeft: `${paddingLeft}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: textBox.textAlign === 'center' ? 'center' : textBox.textAlign === 'right' ? 'flex-end' : 'flex-start',
  }

  // Background removed - only blob background is supported

  // Add shadow
  if (textBox.enableShadow) {
    const shadowColor = textBox.shadowColor || 'rgba(0, 0, 0, 0.3)'
    const shadowBlur = textBox.shadowBlur ?? 4
    const shadowOffsetX = textBox.shadowOffsetX ?? 2
    const shadowOffsetY = textBox.shadowOffsetY ?? 2
    textStyle.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`
  }

  // Note: Satori doesn't support text-stroke, so outline will be approximated with shadow
  if (textBox.outlineWidth && textBox.outlineWidth > 0) {
    const outlineColor = textBox.outlineColor || '#000000'
    // Use multiple shadows to simulate outline
    const outlineSize = textBox.outlineWidth
    textStyle.textShadow = `
      ${outlineSize}px ${outlineSize}px 0 ${outlineColor},
      -${outlineSize}px ${outlineSize}px 0 ${outlineColor},
      ${outlineSize}px -${outlineSize}px 0 ${outlineColor},
      -${outlineSize}px -${outlineSize}px 0 ${outlineColor}
    `.trim()
  }

  const elements: React.ReactElement[] = []

  // Add blob background if enabled
  if (textBox.enableBlobBackground) {
    const blobColor = textBox.blobColor || '#ffffff'
    const blobOpacity = textBox.blobOpacity ?? 1
    const blobSpread = textBox.blobSpread ?? 20
    const blobRoundness = textBox.blobRoundness ?? 0.5

    // Measure text lines (using server-side estimation)
    const lines = estimateTextMeasurements(textBox.text, textBox.fontSize, textBox.fontFamily)

    // Generate TikTok-style blob path (stable rounded rectangles)
    const blobPath = generateTextHuggingBlob({
      lines,
      lineHeight: textBox.fontSize * (textBox.lineHeight ?? 1.2),
      spread: blobSpread,
      roundness: blobRoundness,
    })

    // Calculate blob dimensions
    const maxLineWidth = Math.max(...lines.map((l) => l.width))
    const totalTextHeight = lines.length * textBox.fontSize * (textBox.lineHeight ?? 1.2)
    const viewBoxWidth = maxLineWidth + blobSpread * 2
    const viewBoxHeight = totalTextHeight + blobSpread * 2

    elements.push(
      <svg
        key={`${textBox.id}-blob`}
        viewBox={`${-blobSpread} ${-blobSpread} ${viewBoxWidth} ${viewBoxHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          left: `${paddingLeft}px`,
          top: `${paddingTop}px`,
          width: `${viewBoxWidth}px`,
          height: `${viewBoxHeight}px`,
          opacity: blobOpacity,
        }}
      >
        <path fill={blobColor} d={blobPath} />
      </svg>
    )
  }

  // Add text
  elements.push(
    <div key={`${textBox.id}-text`} style={textStyle}>
      {textBox.text}
    </div>
  )

  return (
    <div key={textBox.id} style={containerStyle}>
      {elements}
    </div>
  )
}

/**
 * Render slide to JSX for Satori
 */
export function renderSlideToJSX(slide: SlideData): React.ReactElement {
  const { canvas, backgroundLayers, textBoxes } = slide
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // Canvas container style
  const canvasStyle: React.CSSProperties = {
    width: `${canvasWidth}px`,
    height: `${canvasHeight}px`,
    position: 'relative',
    display: 'flex',
    backgroundColor: '#ffffff',
  }

  // Sort layers and text boxes by zIndex
  const sortedLayers = [...backgroundLayers].sort((a, b) => a.zIndex - b.zIndex)
  const sortedTextBoxes = [...textBoxes].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div style={canvasStyle}>
      {/* Render background layers */}
      {sortedLayers.map((layer) => renderBackgroundLayer(layer, canvasWidth, canvasHeight))}

      {/* Render text boxes */}
      {sortedTextBoxes.map((textBox) => renderTextBox(textBox, canvasWidth, canvasHeight))}
    </div>
  )
}
