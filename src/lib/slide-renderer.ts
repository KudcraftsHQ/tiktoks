import type { RemixSlideType, RemixTextBoxType } from '@/lib/validations/remix-schema'
import { getProxiedImageUrlById } from '@/lib/image-proxy'

/**
 * Render a slide to a data URL for thumbnail generation
 * Uses HTML5 Canvas API for accurate rendering
 */

/**
 * Load an image from a URL and return an HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

export interface ThumbnailDimensions {
  width: number
  height: number
}

export const THUMBNAIL_SIZES = {
  sm: { width: 48, height: 85 },   // Thumbnail strip
  md: { width: 96, height: 170 },  // Content grid
  lg: { width: 150, height: 267 }  // Dialog preview
} as const

/**
 * Main function to render a slide to a data URL
 */
export async function renderSlideToDataURL(
  slide: RemixSlideType,
  dimensions: ThumbnailDimensions = THUMBNAIL_SIZES.sm,
  options: { format?: 'png' | 'jpeg'; quality?: number } = {}
): Promise<string> {
  const { format = 'png', quality = 0.9 } = options

  // Create full-size canvas (Instagram Story dimensions)
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')!

  // Render background layers
  await renderBackgroundLayers(ctx, slide.backgroundLayers || [], 1080, 1920)

  // Render text boxes
  renderTextBoxes(ctx, slide.textBoxes || [], 1080, 1920)

  // Scale down to thumbnail size
  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = dimensions.width
  thumbCanvas.height = dimensions.height
  const thumbCtx = thumbCanvas.getContext('2d')!

  // Use high-quality scaling
  thumbCtx.imageSmoothingEnabled = true
  thumbCtx.imageSmoothingQuality = 'high'
  thumbCtx.drawImage(canvas, 0, 0, dimensions.width, dimensions.height)

  // Convert to data URL
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  return thumbCanvas.toDataURL(mimeType, quality)
}

/**
 * Render background layers (color, gradient, or image)
 */
async function renderBackgroundLayers(
  ctx: CanvasRenderingContext2D,
  layers: any[],
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  // If no background layers, render dark gray
  if (!layers || layers.length === 0) {
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    return
  }

  for (const layer of layers) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1

    if (layer.type === 'color') {
      // Solid color background
      ctx.fillStyle = layer.color || '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    } else if (layer.type === 'gradient' && layer.gradient) {
      // Gradient background
      const angle = layer.gradient.angle || 0
      const rad = (angle * Math.PI) / 180

      const gradient = ctx.createLinearGradient(
        canvasWidth / 2 - Math.cos(rad) * canvasWidth,
        canvasHeight / 2 - Math.sin(rad) * canvasHeight,
        canvasWidth / 2 + Math.cos(rad) * canvasWidth,
        canvasHeight / 2 + Math.sin(rad) * canvasHeight
      )

      layer.gradient.colors.forEach((color: string, index: number) => {
        const stop = index / (layer.gradient.colors.length - 1)
        gradient.addColorStop(stop, color)
      })

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    } else if (layer.type === 'image' && layer.cacheAssetId) {
      // Image background - load and render
      try {
        const imageUrl = getProxiedImageUrlById(layer.cacheAssetId)
        const img = await loadImage(imageUrl)

        // Calculate dimensions based on fitMode
        const layerX = layer.x * canvasWidth
        const layerY = layer.y * canvasHeight
        const layerWidth = layer.width * canvasWidth
        const layerHeight = layer.height * canvasHeight

        // Apply rotation if needed
        if (layer.rotation !== 0) {
          ctx.translate(layerX + layerWidth / 2, layerY + layerHeight / 2)
          ctx.rotate((layer.rotation * Math.PI) / 180)
          ctx.translate(-(layerX + layerWidth / 2), -(layerY + layerHeight / 2))
        }

        // Render based on fitMode
        switch (layer.fitMode) {
          case 'cover': {
            // Scale image to cover entire area while maintaining aspect ratio
            const scale = Math.max(layerWidth / img.width, layerHeight / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const offsetX = (layerWidth - scaledWidth) / 2
            const offsetY = (layerHeight - scaledHeight) / 2
            ctx.drawImage(img, layerX + offsetX, layerY + offsetY, scaledWidth, scaledHeight)
            break
          }
          case 'contain': {
            // Scale image to fit within area while maintaining aspect ratio
            const scale = Math.min(layerWidth / img.width, layerHeight / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const offsetX = (layerWidth - scaledWidth) / 2
            const offsetY = (layerHeight - scaledHeight) / 2
            ctx.drawImage(img, layerX + offsetX, layerY + offsetY, scaledWidth, scaledHeight)
            break
          }
          case 'fill':
            // Stretch to fill
            ctx.drawImage(img, layerX, layerY, layerWidth, layerHeight)
            break
          case 'fit-width': {
            // Scale to fit width
            const scale = layerWidth / img.width
            const scaledHeight = img.height * scale
            ctx.drawImage(img, layerX, layerY, layerWidth, scaledHeight)
            break
          }
          case 'fit-height': {
            // Scale to fit height
            const scale = layerHeight / img.height
            const scaledWidth = img.width * scale
            ctx.drawImage(img, layerX, layerY, scaledWidth, layerHeight)
            break
          }
          default:
            ctx.drawImage(img, layerX, layerY, layerWidth, layerHeight)
        }
      } catch (error) {
        console.error('Failed to load background image:', error)
        // Fallback to dark gray background
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      }
    }

    ctx.restore()
  }
}

/**
 * Render all text boxes on the canvas
 */
function renderTextBoxes(
  ctx: CanvasRenderingContext2D,
  textBoxes: RemixTextBoxType[],
  canvasWidth: number,
  canvasHeight: number
): void {
  // Sort by z-index to render in correct order
  const sorted = [...textBoxes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  for (const textBox of sorted) {
    renderTextBox(ctx, textBox, canvasWidth, canvasHeight)
  }
}

/**
 * Render a single text box with all styling
 */
function renderTextBox(
  ctx: CanvasRenderingContext2D,
  textBox: RemixTextBoxType,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save()

  const x = textBox.x * canvasWidth
  const y = textBox.y * canvasHeight
  const width = textBox.width * canvasWidth
  const height = textBox.height * canvasHeight

  // Apply transform
  if (textBox.transform) {
    ctx.translate(x + width / 2, y + height / 2)
    ctx.rotate((textBox.transform.rotation || 0) * Math.PI / 180)
    ctx.scale(textBox.transform.scaleX || 1, textBox.transform.scaleY || 1)
    ctx.translate(-(x + width / 2), -(y + height / 2))
  }

  // Draw background
  if (textBox.backgroundColor && (textBox.backgroundOpacity ?? 1) > 0) {
    ctx.fillStyle = textBox.backgroundColor
    ctx.globalAlpha = textBox.backgroundOpacity ?? 1

    // Draw rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, textBox.borderRadius || 0)
    ctx.fill()

    ctx.globalAlpha = 1
  }

  // Draw border
  if (textBox.borderWidth && textBox.borderWidth > 0) {
    ctx.strokeStyle = textBox.borderColor || '#000000'
    ctx.lineWidth = textBox.borderWidth
    drawRoundedRect(ctx, x, y, width, height, textBox.borderRadius || 0)
    ctx.stroke()
  }

  // Prepare text rendering
  const fontSize = textBox.fontSize || 24
  const fontWeight = textBox.fontWeight || 'normal'
  const fontStyle = textBox.fontStyle || 'normal'
  const fontFamily = textBox.fontFamily || 'Arial'

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.fillStyle = textBox.color || '#000000'
  ctx.textBaseline = 'top'

  // Handle text alignment
  const textAlign = textBox.textAlign || 'left'
  ctx.textAlign = textAlign as CanvasTextAlign

  // Calculate text position considering padding
  const paddingTop = textBox.paddingTop || 0
  const paddingLeft = textBox.paddingLeft || 0
  const paddingRight = textBox.paddingRight || 0
  const maxWidth = width - paddingLeft - paddingRight

  // Apply text shadow if enabled
  if (textBox.enableShadow) {
    ctx.shadowColor = textBox.shadowColor || '#000000'
    ctx.shadowBlur = textBox.shadowBlur || 0
    ctx.shadowOffsetX = textBox.shadowOffsetX || 0
    ctx.shadowOffsetY = textBox.shadowOffsetY || 0
  }

  // Apply text outline
  if (textBox.outlineWidth && textBox.outlineWidth > 0) {
    ctx.strokeStyle = textBox.outlineColor || '#000000'
    ctx.lineWidth = textBox.outlineWidth
  }

  // Wrap text and draw
  const lines = wrapText(ctx, textBox.text || '', maxWidth)
  const lineHeight = fontSize * (textBox.lineHeight || 1.2)

  lines.forEach((line, i) => {
    let textX = x + paddingLeft
    if (textAlign === 'center') {
      textX = x + width / 2
    } else if (textAlign === 'right') {
      textX = x + width - paddingRight
    }

    const textY = y + paddingTop + (i * lineHeight)

    // Draw outline first
    if (textBox.outlineWidth && textBox.outlineWidth > 0) {
      ctx.strokeText(line, textX, textY)
    }

    // Draw text
    ctx.fillText(line, textX, textY)
  })

  ctx.restore()
}

/**
 * Wrap text to fit within max width
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return []

  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }

    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

/**
 * Draw a rounded rectangle path
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  if (radius === 0) {
    ctx.rect(x, y, width, height)
    return
  }

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/**
 * Generate a cache key for a slide to avoid re-rendering
 */
export function getSlideCacheKey(slide: RemixSlideType): string {
  return JSON.stringify({
    bg: slide.backgroundLayers,
    text: slide.textBoxes?.map(tb => ({
      text: tb.text,
      x: tb.x,
      y: tb.y,
      width: tb.width,
      height: tb.height,
      fontSize: tb.fontSize,
      fontFamily: tb.fontFamily,
      fontWeight: tb.fontWeight,
      color: tb.color,
      backgroundColor: tb.backgroundColor,
      borderRadius: tb.borderRadius
    }))
  })
}
