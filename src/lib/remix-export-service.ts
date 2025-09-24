/**
 * Remix Export Service
 *
 * Service for exporting remix slides as images and ZIP archives
 */

import { createCanvas, loadImage, registerFont, Canvas, CanvasRenderingContext2D } from '@napi-rs/canvas'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from './cache-asset-service'
import JSZip from 'jszip'

const prisma = new PrismaClient()

interface RemixSlide {
  id: string
  displayOrder: number
  originalImageId?: string | null
  backgroundImageId?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
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
  originalPost: {
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

const CANVAS_WIDTH = 540
const CANVAS_HEIGHT = 960

export class RemixExportService {
  private canvas: Canvas
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)
    this.ctx = this.canvas.getContext('2d')
  }

  async exportSlide(
    slide: RemixSlide,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    const {
      format = 'png',
      quality = 0.95,
      width = CANVAS_WIDTH,
      height = CANVAS_HEIGHT
    } = options

    console.log(`🎨 [Export] Rendering slide ${slide.id}`)

    // Resize canvas if needed
    if (width !== CANVAS_WIDTH || height !== CANVAS_HEIGHT) {
      this.canvas.width = width
      this.canvas.height = height
    } else {
      this.canvas.width = CANVAS_WIDTH
      this.canvas.height = CANVAS_HEIGHT
    }

    // Clear canvas
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw background image if present
    await this.drawBackgroundImage(slide)

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

  private async drawBackgroundImage(slide: RemixSlide): Promise<void> {
    const imageId = slide.backgroundImageId || slide.originalImageId
    if (!imageId) return

    try {
      console.log(`🖼️ [Export] Loading background image: ${imageId}`)

      // Get the image URL
      const imageUrl = await cacheAssetService.getUrl(imageId)
      if (!imageUrl) {
        console.warn(`⚠️ [Export] No URL available for image: ${imageId}`)
        return
      }

      // Load and draw the image
      const image = await loadImage(imageUrl)

      // Calculate scaled dimensions and position
      const scaleX = slide.backgroundImageZoom
      const scaleY = slide.backgroundImageZoom

      const scaledWidth = image.width * scaleX
      const scaledHeight = image.height * scaleY

      // Calculate crop position (center the cropped area on the positioned point)
      const cropX = Math.max(0, (scaledWidth - this.canvas.width) * slide.backgroundImagePositionX)
      const cropY = Math.max(0, (scaledHeight - this.canvas.height) * slide.backgroundImagePositionY)

      // Draw the image
      this.ctx.drawImage(
        image,
        cropX, cropY, this.canvas.width, this.canvas.height,
        0, 0, this.canvas.width, this.canvas.height
      )

      console.log(`✅ [Export] Background image rendered`)
    } catch (error) {
      console.error(`❌ [Export] Failed to load background image:`, error)
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
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        },
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

    console.log(`📦 [Export] Found remix with ${remix.slides.length} slides`)

    const zip = new JSZip()
    const { format = 'png' } = options

    // Export each slide
    for (let i = 0; i < remix.slides.length; i++) {
      const slide = remix.slides[i]
      console.log(`🎨 [Export] Exporting slide ${i + 1}/${remix.slides.length}`)

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
- Original Author: ${remix.originalPost.authorNickname || remix.originalPost.authorHandle || 'Unknown'}
- Generation Type: ${remix.generationType}
- Total Slides: ${remix.slides.length}
- Export Date: ${new Date().toISOString()}

## Files
${remix.slides.map((_, i) =>
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