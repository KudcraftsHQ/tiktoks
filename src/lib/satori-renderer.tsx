/**
 * Satori Renderer
 * Generates JSX with inline styles for Satori rendering
 */

import { generateTextHuggingBlob } from './blob-generator'
import { measureTextLinesSync, getFontPath, estimateTextMeasurements } from './text-measurement-server'
import { parseTextWithEmojis } from './text-parser'
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

  // Text effects (mutually exclusive recommended)
  // Effect 1: Shadow
  enableShadow?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number

  // Effect 2: Outline (Character Outline)
  outlineWidth?: number
  outlineColor?: string

  // Effect 3: Blob background (Hugging Background)
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
    opacity: layer.opacity ?? 1,
    display: 'flex',
  }

  if (layer.type === 'color' && layer.color) {
    style.backgroundColor = layer.color
  } else if (layer.type === 'gradient' && layer.gradient) {
    const { type, colors = [], angle = 0 } = layer.gradient

    // Filter out any undefined/null colors and ensure they're strings
    const validColors = colors.filter(c => c != null).map(c => String(c).trim())

    if (validColors.length > 0) {
      const colorStops = validColors.join(', ')
      if (type === 'linear') {
        style.backgroundImage = `linear-gradient(${angle}deg, ${colorStops})`
      } else {
        style.backgroundImage = `radial-gradient(circle, ${colorStops})`
      }
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
 * Render a text box with optional blob background or character outline
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
    flexDirection: 'column', // Changed to column to support multiline properly if needed
    justifyContent: 'flex-start', // Align based on content flow
    alignItems: textBox.textAlign === 'center' ? 'center' : textBox.textAlign === 'right' ? 'flex-end' : 'flex-start',
  }

  // Ensure all font properties are properly defined strings/numbers
  const fontFamily = String(textBox.fontFamily || 'Poppins').trim()
  const fontWeight = textBox.fontWeight || 400
  const fontStyle = String(textBox.fontStyle || 'normal').trim()
  const textAlign = String(textBox.textAlign || 'left').trim()
  const textDecoration = String(textBox.textDecoration || 'none').trim()

  // Base text style with safe defaults - only include defined values
  const baseTextStyle: React.CSSProperties = {
    fontFamily,
    fontSize: `${textBox.fontSize}px`,
    fontWeight,
    fontStyle: fontStyle as 'normal' | 'italic',
    textAlign: textAlign as 'left' | 'center' | 'right',
    textDecoration,
    lineHeight: textBox.lineHeight ?? 1.2,
    paddingTop: `${paddingTop}px`,
    paddingRight: `${paddingRight}px`,
    paddingBottom: `${paddingBottom}px`,
    paddingLeft: `${paddingLeft}px`,
    display: 'flex',
    flexWrap: 'wrap', // Essential for word wrapping
    width: '100%', // Take full width of container
    justifyContent: textBox.textAlign === 'center' ? 'center' : textBox.textAlign === 'right' ? 'flex-end' : 'flex-start',
    wordBreak: 'break-word', // Ensure breaking matches browser behavior
  }

  // Only add letterSpacing if it's defined
  if (textBox.letterSpacing) {
    baseTextStyle.letterSpacing = `${textBox.letterSpacing}px`
  }

  // Apply shadow if enabled (and not using outline)
  if (textBox.enableShadow && !textBox.outlineWidth) {
    const shadowColor = textBox.shadowColor || 'rgba(0, 0, 0, 0.3)'
    const shadowBlur = textBox.shadowBlur ?? 4
    const shadowOffsetX = textBox.shadowOffsetX ?? 2
    const shadowOffsetY = textBox.shadowOffsetY ?? 2
    baseTextStyle.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`
  }

  const elements: React.ReactElement[] = []

  // 1. Blob Background (Hugging Text)
  if (textBox.enableBlobBackground) {
    const blobColor = textBox.blobColor || '#ffffff'
    const blobOpacity = textBox.blobOpacity ?? 1
    const blobSpread = textBox.blobSpread ?? 20
    const blobRoundness = textBox.blobRoundness ?? 0.5

    // Measure text lines (using server-side accurate measurement if available)
    // We try to use fontkit for pixel-perfect matching with frontend
    let lines
    try {
      const fontPath = getFontPath(textBox.fontFamily, textBox.fontWeight)
      lines = measureTextLinesSync({
        text: textBox.text,
        fontSize: textBox.fontSize,
        fontPath,
        lineHeight: textBox.lineHeight
      })
    } catch (e) {
      console.warn('Falling back to estimated measurements:', e)
      lines = estimateTextMeasurements(textBox.text, textBox.fontSize, textBox.fontFamily)
    }

    // Calculate available width for text (excluding padding)
    // Note: Satori rendering needs this for proper alignment calculation
    // The container width is the full width of the text box minus padding
    const availableWidth = boxWidth - paddingLeft - paddingRight

    // Generate TikTok-style blob path
    const blobPath = generateTextHuggingBlob({
      lines,
      lineHeight: textBox.fontSize * (textBox.lineHeight ?? 1.2),
      spread: blobSpread,
      roundness: blobRoundness,
      align: textBox.textAlign,
      containerWidth: availableWidth // Pass container width
    })

    // Calculate blob dimensions
    const maxLineWidth = Math.max(...lines.map((l) => l.width), 0)
    const totalTextHeight = lines.length * textBox.fontSize * (textBox.lineHeight ?? 1.2)
    
    // Use availableWidth to ensure viewBox covers full container width for alignment offsets
    const viewBoxWidth = availableWidth + blobSpread * 2
    const viewBoxHeight = totalTextHeight + blobSpread * 2

    elements.push(
      <svg
        key={`${textBox.id}-blob`}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          left: `${paddingLeft - blobSpread}px`, // Shift left by spread to align visual origin
          top: `${paddingTop - blobSpread}px`, // Shift up by spread
          width: `${viewBoxWidth}px`,
          height: `${viewBoxHeight}px`,
          opacity: blobOpacity,
        }}
      >
        <path fill={blobColor} d={blobPath} />
      </svg>
    )
  }

  // 2. Render Text Content
  // Check if we need to render segments (for outline + emojis)
  if (textBox.outlineWidth && textBox.outlineWidth > 0) {
    const outlineColor = textBox.outlineColor || '#000000'
    const outlineWidth = textBox.outlineWidth
    const textColor = textBox.color || '#000000'
    const segments = parseTextWithEmojis(textBox.text)

    // For outlines, we need to be careful.
    // Satori supports standard CSS text-stroke-width and text-stroke-color.
    // Emojis should NOT have this stroke.

    elements.push(
      <div key={`${textBox.id}-text`} style={baseTextStyle}>
        {segments.map((segment, i) => {
          if (segment.isEmoji) {
            // Emojis: No stroke
            return (
              <span key={i} style={{
                color: textColor,
              }}>
                {segment.content}
              </span>
            )
          } else {
            // Text: Apply stroke
            // Note: textStroke is supported by Satori but not widely in TS types yet, so we cast to any or use style object
            return (
              <span key={i} style={{
                color: textColor,
                // @ts-ignore
                WebkitTextStroke: `${outlineWidth}px ${outlineColor}`,
              }}>
                {segment.content}
              </span>
            )
          }
        })}
      </div>
    )
  } else {
    // Standard rendering (no outline logic needed)
    elements.push(
      <div key={`${textBox.id}-text`} style={{
        ...baseTextStyle,
        color: textBox.color || '#000000',
      }}>
        {textBox.text}
      </div>
    )
  }

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
