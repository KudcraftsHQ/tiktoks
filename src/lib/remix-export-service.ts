/**
 * Remix Export Service
 *
 * Service for exporting remix slides as images and ZIP archives
 */

import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from './cache-asset-service'
import JSZip from 'jszip'

const prisma = new PrismaClient()

// Dynamic imports for canvas functionality - Use require for native modules
let canvasModule: any = null
async function getCanvasModule() {
  if (!canvasModule) {
    try {
      console.log('🔍 [Canvas] Attempting to load @napi-rs/canvas...')
      console.log('🔍 [Canvas] process.platform:', process.platform)
      console.log('🔍 [Canvas] process.arch:', process.arch)
      console.log('🔍 [Canvas] NODE_ENV:', process.env.NODE_ENV)
      
      // Use require instead of import for better compatibility with native modules
      // This avoids bundling issues with Next.js/Turbopack
      canvasModule = require('@napi-rs/canvas')
      
      console.log('✅ [Canvas] Module loaded successfully')
      console.log('✅ [Canvas] Available exports:', Object.keys(canvasModule))
    } catch (error) {
      console.error('❌ [Canvas] Failed to load module:', error)
      if (error instanceof Error) {
        console.error('❌ [Canvas] Error name:', error.name)
        console.error('❌ [Canvas] Error message:', error.message)
        console.error('❌ [Canvas] Error stack:', error.stack)
        console.error('❌ [Canvas] Error cause:', (error as any).cause)
      }
      throw error
    }
  }
  return canvasModule
}

interface BackgroundLayer {
  id: string
  type: 'image' | 'color' | 'gradient'
  cacheAssetId?: string
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
  rotation?: number
  fitMode?: 'cover' | 'contain' | 'fill' | 'fit-width' | 'fit-height'
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
  viewport?: {
    zoom: number
    offsetX: number
    offsetY: number
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
    textWrap?: 'none' | 'wrap' | 'ellipsis'
    enableShadow?: boolean
    shadowColor?: string
    shadowBlur?: number
    shadowOffsetX?: number
    shadowOffsetY?: number
    outlineWidth?: number
    outlineColor?: string
    backgroundColor?: string
    backgroundOpacity?: number
    borderRadius?: number
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
    lineHeight?: number
    letterSpacing?: number
    transform?: {
      rotation?: number
      scaleX?: number
      scaleY?: number
      skewX?: number
      skewY?: number
    }
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
const DEG_TO_RAD = Math.PI / 180

function degToRad(degrees: number = 0) {
  return degrees * DEG_TO_RAD
}

function hexToRgba(hex: string, alpha = 1): string {
  if (!hex) {
    return `rgba(0, 0, 0, ${alpha})`
  }

  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return hex
  }

  const num = parseInt(normalized, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius = 0) {
  const r = Math.max(Math.min(radius, width / 2, height / 2), 0)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export class RemixExportService {
  private canvas: any = null
  private ctx: any = null

  async initCanvas() {
    if (!this.canvas) {
      console.log(`🎨 [Export] Initializing canvas module...`)
      console.log(`🎨 [Export] Platform: ${process.platform}, Architecture: ${process.arch}`)
      try {
        const { createCanvas } = await getCanvasModule()
        console.log(`🎨 [Export] Canvas module loaded successfully`)
        console.log(`🎨 [Export] Creating canvas: ${DEFAULT_CANVAS_WIDTH}x${DEFAULT_CANVAS_HEIGHT}`)
        this.canvas = createCanvas(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT)
        this.ctx = this.canvas.getContext('2d')
        console.log(`✅ [Export] Canvas initialized successfully`)
      } catch (error) {
        console.error(`❌ [Export] Failed to initialize canvas:`, error)
        console.error(`❌ [Export] Platform: ${process.platform}, Arch: ${process.arch}`)
        throw new Error(`Failed to initialize canvas: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
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
    console.log(`🎨 [Export] Export options:`, { format, quality, width, height })
    console.log(`🎨 [Export] Slide canvas:`, slide.canvas)
    console.log(`🎨 [Export] Background layers count:`, slide.backgroundLayers?.length || 0)
    console.log(`🎨 [Export] Background layers:`, JSON.stringify(slide.backgroundLayers, null, 2))
    console.log(`🎨 [Export] Text boxes count:`, slide.textBoxes?.length || 0)
    console.log(`🎨 [Export] Text boxes:`, JSON.stringify(slide.textBoxes?.map(tb => ({
      id: tb.id,
      text: tb.text?.substring(0, 50),
      x: tb.x,
      y: tb.y,
      width: tb.width,
      height: tb.height,
      fontSize: tb.fontSize
    })), null, 2))
    
    // Validate slide structure
    if (!slide.textBoxes) {
      console.warn(`⚠️ [Export] Slide ${slide.id} missing textBoxes array, initializing as empty`)
      slide.textBoxes = []
    }
    if (!slide.backgroundLayers) {
      console.warn(`⚠️ [Export] Slide ${slide.id} missing backgroundLayers array, initializing as empty`)
      slide.backgroundLayers = []
    }

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
    console.log(`🎨 [Export] Converting canvas to ${format} buffer...`)
    try {
      let buffer: Buffer
      if (format === 'jpeg') {
        console.log(`🎨 [Export] Encoding as JPEG with quality ${quality}`)
        buffer = this.canvas.toBuffer('image/jpeg', quality)
      } else {
        console.log(`🎨 [Export] Encoding as PNG`)
        buffer = this.canvas.toBuffer('image/png')
      }
      console.log(`✅ [Export] Buffer generated successfully: ${buffer.length} bytes`)
      return buffer
    } catch (error) {
      console.error(`❌ [Export] Failed to generate ${format} buffer:`, error)
      throw new Error(`Failed to generate ${format} buffer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async drawBackgroundLayer(layer: BackgroundLayer): Promise<void> {
    try {
      console.log(`🎨 [Export] Drawing background layer: ${layer.type}`)
      const canvasWidth = this.canvas.width
      const canvasHeight = this.canvas.height
      const offsetX = (layer.x || 0) * canvasWidth
      const offsetY = (layer.y || 0) * canvasHeight
      const baseWidth = (layer.width || 1) * canvasWidth
      const baseHeight = (layer.height || 1) * canvasHeight
      const rotation = degToRad(layer.rotation || 0)

      this.ctx.save()
      this.ctx.globalAlpha = layer.opacity ?? 1

      if (layer.blendMode && layer.blendMode !== 'normal') {
        this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
      }

      this.ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY)
      if (rotation) {
        this.ctx.rotate(rotation)
      }

      switch (layer.type) {
        case 'color': {
          if (layer.color) {
            this.ctx.fillStyle = layer.color
            this.ctx.fillRect(-baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)
          }
          break
        }
        case 'gradient': {
          const gradientConfig = layer.gradient
          if (gradientConfig) {
            let gradient: CanvasGradient
            const halfW = baseWidth / 2
            const halfH = baseHeight / 2

            if (gradientConfig.type === 'linear') {
              const angle = degToRad(gradientConfig.angle || 0)
              const x1 = -Math.cos(angle) * halfW
              const y1 = -Math.sin(angle) * halfH
              const x2 = Math.cos(angle) * halfW
              const y2 = Math.sin(angle) * halfH
              gradient = this.ctx.createLinearGradient(x1, y1, x2, y2)
            } else {
              const centerX = (gradientConfig.centerX ?? 0.5) * baseWidth - halfW
              const centerY = (gradientConfig.centerY ?? 0.5) * baseHeight - halfH
              const radius = Math.max(baseWidth, baseHeight) / 2
              gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
            }

            gradientConfig.colors.forEach((color, index) => {
              gradient.addColorStop(index / Math.max(gradientConfig.colors.length - 1, 1), color)
            })

            this.ctx.fillStyle = gradient
            this.ctx.fillRect(-baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)
          }
          break
        }
        case 'image': {
          if (layer.cacheAssetId) {
            console.log(`🖼️ [Export] Loading background image: ${layer.cacheAssetId}`)
            const imageUrl = await cacheAssetService.getUrl(layer.cacheAssetId)
            if (!imageUrl) {
              console.warn(`⚠️ [Export] No URL available for image: ${layer.cacheAssetId}`)
              break
            }

            const { loadImage } = await getCanvasModule()
            const image = await loadImage(imageUrl)

            const fitMode = layer.fitMode || 'cover'
            const widthScale = baseWidth / image.width
            const heightScale = baseHeight / image.height
            let scale = 1

            switch (fitMode) {
              case 'contain':
                scale = Math.min(widthScale, heightScale)
                break
              case 'fit-width':
                scale = widthScale
                break
              case 'fit-height':
                scale = heightScale
                break
              case 'fill':
                scale = 1
                break
              case 'cover':
              default:
                scale = Math.max(widthScale, heightScale)
                break
            }

            const renderWidth = fitMode === 'fill' ? baseWidth : image.width * scale
            const renderHeight = fitMode === 'fill' ? baseHeight : image.height * scale

            this.ctx.drawImage(
              image,
              -renderWidth / 2,
              -renderHeight / 2,
              renderWidth,
              renderHeight
            )

            console.log(`✅ [Export] Background image rendered`)
          }
          break
        }
      }

      this.ctx.restore()
      this.ctx.globalCompositeOperation = 'source-over'
      this.ctx.globalAlpha = 1

    } catch (error) {
      console.error(`❌ [Export] Failed to draw background layer:`, error)
    }
  }

  private async drawTextBox(textBox: any): Promise<void> {
    console.log(`📝 [Export] Drawing text box: ${textBox.id}`)

    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    const boxWidth = (textBox.width || 0) * canvasWidth
    const boxX = (textBox.x || 0) * canvasWidth
    const boxY = (textBox.y || 0) * canvasHeight

    const paddingTop = textBox.paddingTop ?? 8
    const paddingRight = textBox.paddingRight ?? 12
    const paddingBottom = textBox.paddingBottom ?? 8
    const paddingLeft = textBox.paddingLeft ?? 12

    const contentWidth = Math.max(10, boxWidth - paddingLeft - paddingRight)

    const fontSize = textBox.fontSize || 24
    const fontFamily = textBox.fontFamily || 'Arial'
    const weightValue = textBox.fontWeight || '400'
    const fontWeight = ['bold', 'bolder', '600', '700', '800', '900'].includes(weightValue) ? 'bold' : weightValue
    const fontStyle = textBox.fontStyle === 'italic' ? 'italic' : 'normal'
    const lineHeight = fontSize * (textBox.lineHeight || 1.2)

    // Set font before measuring text
    this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`

    const wrapMode = textBox.textWrap || 'wrap'
    const lines = this.wrapText(textBox.text || '', contentWidth, wrapMode)
    const totalTextHeight = lines.length * lineHeight

    const rotation = degToRad(textBox.transform?.rotation || 0)
    const centerX = boxX + boxWidth / 2
    const centerY = boxY + totalTextHeight / 2

    this.ctx.save()
    this.ctx.translate(boxX, boxY)
    if (rotation) {
      this.ctx.rotate(rotation)
    }

    // Draw backgrounds for each line individually (box-decoration-break: clone effect)
    // This creates the "wrapped" appearance where each line has its own rounded background
    if (textBox.backgroundColor) {
      this.ctx.fillStyle = hexToRgba(textBox.backgroundColor, textBox.backgroundOpacity ?? 1)
      
      let lineY = 0
      for (const line of lines) {
        const metrics = this.ctx.measureText(line)
        const lineWidth = metrics.width
        const lineBackgroundWidth = lineWidth + paddingLeft + paddingRight
        const lineBackgroundHeight = lineHeight + paddingTop + paddingBottom
        
        // Calculate X position based on text alignment
        let lineX = 0
        if (textBox.textAlign === 'center') {
          lineX = (boxWidth - lineBackgroundWidth) / 2
        } else if (textBox.textAlign === 'right') {
          lineX = boxWidth - lineBackgroundWidth
        }
        
        // Draw rounded rectangle for this line
        drawRoundedRect(
          this.ctx,
          lineX,
          lineY,
          lineBackgroundWidth,
          lineBackgroundHeight,
          textBox.borderRadius || 0
        )
        this.ctx.fill()
        
        lineY += lineHeight
      }
    }

    // Draw borders for each line individually if needed
    if (textBox.borderWidth && textBox.borderWidth > 0) {
      this.ctx.strokeStyle = textBox.borderColor || '#000000'
      this.ctx.lineWidth = textBox.borderWidth
      
      let lineY = 0
      for (const line of lines) {
        const metrics = this.ctx.measureText(line)
        const lineWidth = metrics.width
        const lineBackgroundWidth = lineWidth + paddingLeft + paddingRight
        const lineBackgroundHeight = lineHeight + paddingTop + paddingBottom
        
        let lineX = 0
        if (textBox.textAlign === 'center') {
          lineX = (boxWidth - lineBackgroundWidth) / 2
        } else if (textBox.textAlign === 'right') {
          lineX = boxWidth - lineBackgroundWidth
        }
        
        drawRoundedRect(
          this.ctx,
          lineX,
          lineY,
          lineBackgroundWidth,
          lineBackgroundHeight,
          textBox.borderRadius || 0
        )
        this.ctx.stroke()
        
        lineY += lineHeight
      }
    }

    this.ctx.fillStyle = textBox.color || '#000000'
    this.ctx.textBaseline = 'alphabetic'

    if (textBox.enableShadow) {
      this.ctx.shadowColor = textBox.shadowColor || 'rgba(0,0,0,0.4)'
      this.ctx.shadowBlur = textBox.shadowBlur ?? 4
      this.ctx.shadowOffsetX = textBox.shadowOffsetX ?? 1
      this.ctx.shadowOffsetY = textBox.shadowOffsetY ?? 1
    } else {
      this.ctx.shadowOffsetX = 0
      this.ctx.shadowOffsetY = 0
      this.ctx.shadowBlur = 0
      this.ctx.shadowColor = 'transparent'
    }

    const outlineWidth = textBox.outlineWidth || 0
    if (outlineWidth > 0) {
      this.ctx.lineWidth = outlineWidth * 2
      this.ctx.strokeStyle = textBox.outlineColor || '#000000'
    } else {
      this.ctx.lineWidth = 1
    }

    // Start drawing text from top with proper baseline
    let cursorY = paddingTop + lineHeight * 0.8

    for (const line of lines) {
      let drawX: number
      let textAlign: CanvasTextAlign = 'left'

      switch (textBox.textAlign) {
        case 'center':
          textAlign = 'center'
          drawX = paddingLeft + (boxWidth - paddingLeft - paddingRight) / 2
          break
        case 'right':
          textAlign = 'right'
          drawX = paddingLeft + (boxWidth - paddingLeft - paddingRight)
          break
        case 'justify':
          textAlign = 'left'
          drawX = paddingLeft
          break
        case 'left':
        default:
          textAlign = 'left'
          drawX = paddingLeft
          break
      }

      this.ctx.textAlign = textAlign

      if (outlineWidth > 0) {
        this.ctx.strokeText(line, drawX, cursorY)
      }
      this.ctx.fillText(line, drawX, cursorY)

      if (textBox.textDecoration === 'underline') {
        const metrics = this.ctx.measureText(line)
        let underlineStartX = drawX
        if (textAlign === 'center') {
          underlineStartX = drawX - metrics.width / 2
        } else if (textAlign === 'right') {
          underlineStartX = drawX - metrics.width
        }

        const underlineY = cursorY + fontSize * 0.1
        this.ctx.beginPath()
        this.ctx.moveTo(underlineStartX, underlineY)
        this.ctx.lineTo(underlineStartX + metrics.width, underlineY)
        this.ctx.strokeStyle = textBox.color || '#000000'
        this.ctx.lineWidth = Math.max(1, outlineWidth || 1)
        this.ctx.stroke()
      }

      cursorY += lineHeight
    }

    this.ctx.restore()
    this.ctx.shadowOffsetX = 0
    this.ctx.shadowOffsetY = 0
    this.ctx.shadowBlur = 0
    this.ctx.shadowColor = 'transparent'
    this.ctx.lineWidth = 1
  }

  private wrapText(text: string, maxWidth: number, mode: 'none' | 'wrap' | 'ellipsis' = 'wrap'): string[] {
    const lines: string[] = []
    if (mode === 'none') {
      return [text]
    }

    if (mode === 'ellipsis') {
      const fullWidth = this.ctx.measureText(text).width
      if (fullWidth <= maxWidth) {
        return [text]
      }

      let truncated = text
      while (truncated.length > 0) {
        truncated = truncated.slice(0, -1)
        const candidate = `${truncated}…`
        if (this.ctx.measureText(candidate).width <= maxWidth) {
          return [candidate]
        }
      }

      return ['…']
    }

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
    console.log(`📦 [Export] Export options:`, JSON.stringify(options))

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
      console.error(`❌ [Export] Remix not found: ${remixId}`)
      throw new Error(`Remix not found: ${remixId}`)
    }

    console.log(`📦 [Export] Found remix: ${remix.name}`)
    
    // Parse slides if they come as JSON string (database stores as JSON)
    let remixSlides: any[] = []
    try {
      if (typeof remix.slides === 'string') {
        console.log(`📦 [Export] Parsing slides from JSON string`)
        remixSlides = JSON.parse(remix.slides)
      } else if (Array.isArray(remix.slides)) {
        remixSlides = remix.slides
      } else {
        console.warn(`📦 [Export] Unexpected slides data type: ${typeof remix.slides}`)
      }
      console.log(`📦 [Export] Found remix with ${remixSlides.length} slides`)
    } catch (error) {
      console.error(`❌ [Export] Failed to parse slides:`, error)
      throw new Error(`Failed to parse slides data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const zip = new JSZip()
    const { format = 'png' } = options

    // Export each slide
    for (let i = 0; i < remixSlides.length; i++) {
      const slide = remixSlides[i] as any
      console.log(`\n🎨 [Export] ========================================`)
      console.log(`🎨 [Export] Exporting slide ${i + 1}/${remixSlides.length}`)
      console.log(`🎨 [Export] Slide ID: ${slide.id}`)
      console.log(`🎨 [Export] Slide displayOrder: ${slide.displayOrder}`)

      try {
        console.log(`🎨 [Export] Calling exportSlide...`)
        const imageBuffer = await this.exportSlide(slide, options)
        console.log(`🎨 [Export] exportSlide returned buffer of ${imageBuffer.length} bytes`)
        
        const filename = `${remix.name.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${(i + 1).toString().padStart(2, '0')}.${format}`
        console.log(`🎨 [Export] Adding to ZIP as: ${filename}`)
        zip.file(filename, imageBuffer)

        console.log(`✅ [Export] Slide ${i + 1} exported successfully`)
      } catch (error) {
        console.error(`❌ [Export] Failed to export slide ${i + 1}:`, error)
        console.error(`❌ [Export] Error details:`, error instanceof Error ? error.message : 'Unknown error')
        console.error(`❌ [Export] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
        // Continue with other slides
      }
      console.log(`🎨 [Export] ========================================\n`)
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
    console.log(`📦 [Export] ZIP contains ${Object.keys(zip.files).length} files`)
    try {
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      console.log(`✅ [Export] ZIP export completed successfully: ${zipBuffer.length} bytes`)
      return zipBuffer
    } catch (error) {
      console.error(`❌ [Export] Failed to generate ZIP:`, error)
      throw new Error(`Failed to generate ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export singleton instance
export const remixExportService = new RemixExportService()
export default RemixExportService