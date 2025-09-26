/**
 * Remix Export Service
 *
 * Service for exporting remix slides as images and ZIP archives
 */

import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from './cache-asset-service'
import JSZip from 'jszip'

const prisma = new PrismaClient()

// Dynamic imports for canvas functionality
let canvasModule: any = null
async function getCanvasModule() {
  if (!canvasModule) {
    canvasModule = await import('@napi-rs/canvas')
  }
  return canvasModule
}

interface BackgroundLayer {
  id: string
  type: 'image' | 'color' | 'gradient'
  imageId?: string
  color?: string
  gradient?: {
    type: 'linear' | 'radial'
    colors: string[]
    angle?: number
    centerX?: number
    centerY?: number
  }
  x: number
  y: number
  width: number
  height: number
  opacity: number
  blendMode: string
  zIndex: number
}

interface RemixSlide {
  id: string
  displayOrder: number
  canvas: {
    width: number
    height: number
    unit: string
  }
  backgroundLayers: BackgroundLayer[]
  originalImageIndex: number
  paraphrasedText: string
  originalText?: string
  textBoxes: Array<{
    id: string
    text: string
    x: number
    y: number
    width: number
    height: number
    fontSize: number
    fontFamily: string
    fontWeight: string
    fontStyle: string
    textDecoration: string
    color: string
    textAlign: string
    zIndex: number
    textStroke?: string
    textShadow?: string
    borderWidth?: number
    borderColor?: string
  }>
}

interface RemixPost {
  id: string
  name: string
  description?: string | null
  slides: RemixSlide[]
  originalPost?: {
    id: string
    authorNickname?: string
    authorHandle?: string
  }
}

export interface ExportOptions {
  format?: 'png' | 'jpeg'
  quality?: number
  width?: number
  height?: number
}

const DEFAULT_CANVAS_WIDTH = 1080
const DEFAULT_CANVAS_HEIGHT = 1920

export class RemixExportService {
  private canvas: any = null
  private ctx: any = null

  async initCanvas() {
    if (!this.canvas) {
      const { createCanvas } = await getCanvasModule()
      this.canvas = createCanvas(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT)
      this.ctx = this.canvas.getContext('2d')
    }
  }

  async exportSlide(
    slide: RemixSlide,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    // Initialize canvas if not already done
    await this.initCanvas()

    const {
      format = 'png',
      quality = 0.95,
      width = options.width || slide.canvas?.width || DEFAULT_CANVAS_WIDTH,
      height = options.height || slide.canvas?.height || DEFAULT_CANVAS_HEIGHT
    } = options

    console.log(`🎨 [Export] Rendering slide ${slide.id}`)

    // Set canvas dimensions
    this.canvas.width = width
    this.canvas.height = height

    // Clear canvas with white background
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw background layers (sorted by zIndex)
    if (slide.backgroundLayers && slide.backgroundLayers.length > 0) {
      const sortedLayers = [...slide.backgroundLayers].sort((a, b) => a.zIndex - b.zIndex)
      for (const layer of sortedLayers) {
        await this.drawBackgroundLayer(layer)
      }
    }

    // Draw text boxes (sorted by zIndex)
    const sortedTextBoxes = [...slide.textBoxes].sort((a, b) => a.zIndex - b.zIndex)
    for (const textBox of sortedTextBoxes) {
      await this.drawTextBox(textBox)
    }

    // Export as buffer
    if (format === 'jpeg') {
      return this.canvas.toBuffer('image/jpeg', quality)
    } else {
      return this.canvas.toBuffer('image/png')
    }
  }

  private async drawBackgroundLayer(layer: BackgroundLayer): Promise<void> {
    try {
      console.log(`🎨 [Export] Drawing background layer: ${layer.type}`)

      // Calculate layer dimensions and position
      const layerX = layer.x * this.canvas.width
      const layerY = layer.y * this.canvas.height
      const layerWidth = layer.width * this.canvas.width
      const layerHeight = layer.height * this.canvas.height

      // Save current context state
      this.ctx.save()

      // Apply opacity
      this.ctx.globalAlpha = layer.opacity

      // Apply blend mode if supported
      if (layer.blendMode && layer.blendMode !== 'normal') {
        this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
      }

      switch (layer.type) {
        case 'color':
          if (layer.color) {
            this.ctx.fillStyle = layer.color
            this.ctx.fillRect(layerX, layerY, layerWidth, layerHeight)
          }
          break

        case 'gradient':
          if (layer.gradient) {
            let gradient: CanvasGradient
            if (layer.gradient.type === 'linear') {
              const angle = (layer.gradient.angle || 0) * Math.PI / 180
              const x1 = layerX
              const y1 = layerY
              const x2 = layerX + layerWidth * Math.cos(angle)
              const y2 = layerY + layerHeight * Math.sin(angle)
              gradient = this.ctx.createLinearGradient(x1, y1, x2, y2)
            } else {
              // Radial gradient
              const centerX = layerX + layerWidth * (layer.gradient.centerX || 0.5)
              const centerY = layerY + layerHeight * (layer.gradient.centerY || 0.5)
              const radius = Math.min(layerWidth, layerHeight) / 2
              gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
            }

            // Add color stops
            layer.gradient.colors.forEach((color, index) => {
              gradient.addColorStop(index / (layer.gradient!.colors.length - 1), color)
            })

            this.ctx.fillStyle = gradient
            this.ctx.fillRect(layerX, layerY, layerWidth, layerHeight)
          }
          break

        case 'image':
          if (layer.imageId) {
            console.log(`🖼️ [Export] Loading background image: ${layer.imageId}`)

            // Get the image URL
            const imageUrl = await cacheAssetService.getUrl(layer.imageId)
            if (!imageUrl) {
              console.warn(`⚠️ [Export] No URL available for image: ${layer.imageId}`)
              break
            }

            // Load and draw the image
            const { loadImage } = await getCanvasModule()
            const image = await loadImage(imageUrl)

            // Draw the image with layer positioning and scaling
            this.ctx.drawImage(
              image,
              0, 0, image.width, image.height,
              layerX, layerY, layerWidth, layerHeight
            )

            console.log(`✅ [Export] Background image rendered`)
          }
          break
      }

      // Restore context state
      this.ctx.restore()

    } catch (error) {
      console.error(`❌ [Export] Failed to draw background layer:`, error)
    }
  }

  private async drawTextBox(textBox: any): Promise<void> {
    console.log(`📝 [Export] Drawing text box: ${textBox.id}`)

    const x = textBox.x * this.canvas.width
    const y = textBox.y * this.canvas.height
    const width = textBox.width * this.canvas.width
    const height = textBox.height * this.canvas.height

    // Set font
    const fontWeight = textBox.fontWeight === 'bold' ? 'bold' : 'normal'
    const fontStyle = textBox.fontStyle === 'italic' ? 'italic' : 'normal'
    const fontSize = textBox.fontSize
    const fontFamily = textBox.fontFamily || 'Arial'

    this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`

    // Set text properties
    this.ctx.fillStyle = textBox.color
    this.ctx.textAlign = textBox.textAlign as CanvasTextAlign
    this.ctx.textBaseline = 'middle'

    // Apply text shadow
    if (textBox.textShadow) {
      const shadowMatch = textBox.textShadow.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(.+)/)
      if (shadowMatch) {
        const [, offsetX, offsetY, blur, color] = shadowMatch
        this.ctx.shadowOffsetX = parseFloat(offsetX)
        this.ctx.shadowOffsetY = parseFloat(offsetY)
        this.ctx.shadowBlur = parseFloat(blur)
        this.ctx.shadowColor = color.trim()
      }
    }

    // Apply text stroke
    if (textBox.textStroke) {
      const strokeMatch = textBox.textStroke.match(/(-?\d+(?:\.\d+)?)px\s+(.+)/)
      if (strokeMatch) {
        const [, strokeWidth, strokeColor] = strokeMatch
        this.ctx.strokeStyle = strokeColor.trim()
        this.ctx.lineWidth = parseFloat(strokeWidth)
      }
    }

    // Draw border if present
    if (textBox.borderWidth && textBox.borderWidth > 0) {
      this.ctx.strokeStyle = textBox.borderColor || '#000000'
      this.ctx.lineWidth = textBox.borderWidth
      this.ctx.strokeRect(x, y, width, height)
    }

    // Word wrap and draw text
    const lines = this.wrapText(textBox.text, width - 20) // 20px padding
    const lineHeight = fontSize * 1.2
    const totalTextHeight = lines.length * lineHeight

    // Calculate starting Y position for vertical centering
    let startY = y + height / 2 - totalTextHeight / 2 + lineHeight / 2

    // Calculate X position based on alignment
    let textX = x + width / 2 // center by default
    if (textBox.textAlign === 'left') {
      textX = x + 10
    } else if (textBox.textAlign === 'right') {
      textX = x + width - 10
    }

    // Draw each line
    for (let i = 0; i < lines.length; i++) {
      const lineY = startY + (i * lineHeight)

      // Draw stroke if present
      if (textBox.textStroke && this.ctx.lineWidth > 0) {
        this.ctx.strokeText(lines[i], textX, lineY)
      }

      // Draw fill text
      this.ctx.fillText(lines[i], textX, lineY)

      // Draw underline if needed
      if (textBox.textDecoration === 'underline') {
        const textMetrics = this.ctx.measureText(lines[i])
        const underlineY = lineY + fontSize * 0.1
        let underlineX = textX
        let underlineWidth = textMetrics.width

        if (textBox.textAlign === 'center') {
          underlineX = textX - textMetrics.width / 2
        } else if (textBox.textAlign === 'right') {
          underlineX = textX - textMetrics.width
        }

        this.ctx.beginPath()
        this.ctx.moveTo(underlineX, underlineY)
        this.ctx.lineTo(underlineX + underlineWidth, underlineY)
        this.ctx.strokeStyle = textBox.color
        this.ctx.lineWidth = 1
        this.ctx.stroke()
      }
    }

    // Reset shadow and stroke
    this.ctx.shadowOffsetX = 0
    this.ctx.shadowOffsetY = 0
    this.ctx.shadowBlur = 0
    this.ctx.shadowColor = 'transparent'
    this.ctx.lineWidth = 1
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = []
    const words = text.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = this.ctx.measureText(testLine)

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

    return lines.length ? lines : ['']
  }

  async exportRemixAsZip(remixId: string, options: ExportOptions = {}): Promise<Buffer> {
    console.log(`📦 [Export] Starting ZIP export for remix: ${remixId}`)

    // Get the remix with all slides
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        originalPost: {
          select: {
            id: true,
            authorNickname: true,
            authorHandle: true
          }
        }
      }
    })

    if (!remix) {
      throw new Error(`Remix not found: ${remixId}`)
    }

    const remixSlides = Array.isArray(remix.slides) ? remix.slides : []
    console.log(`📦 [Export] Found remix with ${remixSlides.length} slides`)

    const zip = new JSZip()
    const { format = 'png' } = options

    // Export each slide
    for (let i = 0; i < remixSlides.length; i++) {
      const slide = remixSlides[i] as any
      console.log(`🎨 [Export] Exporting slide ${i + 1}/${remixSlides.length}`)

      try {
        const imageBuffer = await this.exportSlide(slide, options)
        const filename = `${remix.name.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${(i + 1).toString().padStart(2, '0')}.${format}`
        zip.file(filename, imageBuffer)

        console.log(`✅ [Export] Slide ${i + 1} exported as ${filename}`)
      } catch (error) {
        console.error(`❌ [Export] Failed to export slide ${i + 1}:`, error)
        // Continue with other slides
      }
    }

    // Add a README file with remix info
    const readmeContent = `# ${remix.name}

${remix.description || 'AI-generated remix content'}

## Details
- Original Author: ${(remix as any).originalPost?.authorNickname || (remix as any).originalPost?.authorHandle || 'Unknown'}
- Total Slides: ${remixSlides.length}
- Export Date: ${new Date().toISOString()}

## Files
${remixSlides.map((_, i) =>
  `- ${remix.name.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${(i + 1).toString().padStart(2, '0')}.${format}`
).join('\n')}

---
Generated with Remix Studio
`

    zip.file('README.md', readmeContent)

    console.log(`📦 [Export] Generating ZIP file...`)
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    console.log(`✅ [Export] ZIP export completed: ${zipBuffer.length} bytes`)
    return zipBuffer
  }
}

// Export singleton instance
export const remixExportService = new RemixExportService()
export default RemixExportService