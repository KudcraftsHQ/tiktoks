import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from '@napi-rs/canvas'

interface TextBox {
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
  textStroke?: string | null
  textShadow?: string | null
  borderWidth?: number | null
  borderColor?: string | null
}

interface Slide {
  id: string
  backgroundImageUrl?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
  textBoxes: TextBox[]
}

interface RenderOptions {
  format?: 'png' | 'jpeg'
  quality?: number
}

export async function renderSlideToCanvas(slide: Slide, options: RenderOptions = {}): Promise<Buffer> {
  const { format = 'png', quality = 0.95 } = options
  const canvasWidth = 540
  const canvasHeight = 960

  // Create canvas
  const canvas = createCanvas(canvasWidth, canvasHeight)
  const ctx = canvas.getContext('2d')

  // Set white background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Draw background image if available
  if (slide.backgroundImageUrl) {
    try {
      const image = await loadImage(slide.backgroundImageUrl)
      
      // Calculate image positioning
      const imageWidth = image.width
      const imageHeight = image.height
      const aspectRatio = imageWidth / imageHeight
      const canvasAspectRatio = canvasWidth / canvasHeight
      
      let drawWidth, drawHeight, drawX, drawY
      
      // Apply zoom
      const zoom = slide.backgroundImageZoom
      
      if (aspectRatio > canvasAspectRatio) {
        // Image is wider than canvas
        drawHeight = canvasHeight * zoom
        drawWidth = drawHeight * aspectRatio
      } else {
        // Image is taller than canvas
        drawWidth = canvasWidth * zoom
        drawHeight = drawWidth / aspectRatio
      }
      
      // Apply positioning
      drawX = (canvasWidth - drawWidth) * slide.backgroundImagePositionX
      drawY = (canvasHeight - drawHeight) * slide.backgroundImagePositionY
      
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
    } catch (error) {
      console.warn('Failed to load background image:', error)
      // Draw gradient background as fallback
      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
      gradient.addColorStop(0, '#f3f4f6')
      gradient.addColorStop(1, '#d1d5db')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }
  }

  // Sort text boxes by zIndex
  const sortedTextBoxes = [...slide.textBoxes].sort((a, b) => a.zIndex - b.zIndex)

  // Draw text boxes
  for (const textBox of sortedTextBoxes) {
    await drawTextBox(ctx, textBox, canvasWidth, canvasHeight)
  }

  // Return buffer
  if (format === 'png') {
    return canvas.toBuffer('image/png')
  } else {
    return canvas.toBuffer('image/jpeg', { quality })
  }
}

async function drawTextBox(
  ctx: CanvasRenderingContext2D,
  textBox: TextBox,
  canvasWidth: number,
  canvasHeight: number
) {
  // Calculate position and size in pixels
  const x = textBox.x * canvasWidth
  const y = textBox.y * canvasHeight
  const width = textBox.width * canvasWidth
  const height = textBox.height * canvasHeight

  // Set font properties
  const fontSize = textBox.fontSize
  let fontWeight = textBox.fontWeight
  let fontStyle = textBox.fontStyle
  
  // Handle font weight variations
  if (fontWeight === 'bold') fontWeight = 'bold'
  else if (fontWeight === 'normal') fontWeight = 'normal'
  else fontWeight = 'normal'
  
  // Handle font style
  if (fontStyle === 'italic') fontStyle = 'italic'
  else fontStyle = 'normal'

  // Set font (fallback to system fonts for better compatibility)
  const fontFamily = getFontFamily(textBox.fontFamily)
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  
  // Set text properties
  ctx.fillStyle = textBox.color
  ctx.textAlign = textBox.textAlign as CanvasTextAlign
  ctx.textBaseline = 'middle'

  // Handle text stroke
  if (textBox.borderWidth && textBox.borderWidth > 0 && textBox.borderColor) {
    ctx.strokeStyle = textBox.borderColor
    ctx.lineWidth = textBox.borderWidth
  }

  // Handle text shadow
  if (textBox.textShadow) {
    const shadowMatch = textBox.textShadow.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(.+)/)
    if (shadowMatch) {
      const [, offsetX, offsetY, blur, shadowColor] = shadowMatch
      ctx.shadowOffsetX = parseFloat(offsetX)
      ctx.shadowOffsetY = parseFloat(offsetY)
      ctx.shadowBlur = parseFloat(blur)
      ctx.shadowColor = shadowColor.trim()
    }
  }

  // Calculate text positioning within the text box
  let textX = x
  let textY = y + height / 2

  if (textBox.textAlign === 'center') {
    textX = x + width / 2
  } else if (textBox.textAlign === 'right') {
    textX = x + width
  } else {
    textX = x + 8 // Small padding for left alignment
  }

  // Handle multi-line text
  const lines = wrapText(ctx, textBox.text, width - 16) // Account for padding
  const lineHeight = fontSize * 1.2
  const totalTextHeight = lines.length * lineHeight
  
  // Adjust Y position to center the text block vertically
  let startY = textY - (totalTextHeight / 2) + (lineHeight / 2)
  
  // Ensure text stays within bounds
  if (startY < y + lineHeight / 2) {
    startY = y + lineHeight / 2
  } else if (startY + totalTextHeight > y + height - lineHeight / 2) {
    startY = y + height - totalTextHeight + lineHeight / 2
  }

  // Draw each line
  for (let i = 0; i < lines.length; i++) {
    const lineY = startY + i * lineHeight
    
    // Draw stroke first if enabled
    if (textBox.borderWidth && textBox.borderWidth > 0 && textBox.borderColor) {
      ctx.strokeText(lines[i], textX, lineY)
    }
    
    // Draw fill text
    ctx.fillText(lines[i], textX, lineY)
  }

  // Reset shadow
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

function getFontFamily(fontFamily: string): string {
  // Map custom fonts to system fonts for better compatibility
  const fontMap: { [key: string]: string } = {
    'Poppins': 'Arial, sans-serif',
    'Inter': 'Arial, sans-serif',
    'Roboto': 'Arial, sans-serif',
    'Open Sans': 'Arial, sans-serif',
    'Lato': 'Arial, sans-serif',
    'Montserrat': 'Arial, sans-serif',
    'Source Sans Pro': 'Arial, sans-serif',
    'Playfair Display': 'Times, serif',
    'Merriweather': 'Times, serif',
    'Lora': 'Times, serif',
    'Oswald': 'Arial Black, sans-serif',
    'Raleway': 'Arial, sans-serif',
    'Nunito': 'Arial, sans-serif',
    'PT Sans': 'Arial, sans-serif',
    'Ubuntu': 'Arial, sans-serif',
  }

  return fontMap[fontFamily] || 'Arial, sans-serif'
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }

    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > maxWidth && currentLine !== '') {
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

  return lines.length > 0 ? lines : ['']
}