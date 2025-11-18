/**
 * Server-Side Text Measurement
 * Uses fontkit for measuring text without DOM
 */

import * as fontkit from 'fontkit'
import { readFileSync } from 'fs'
import { join } from 'path'

export interface LineMeasurement {
  text: string
  width: number
}

export interface ServerTextMeasurementOptions {
  text: string
  fontSize: number
  fontPath: string // Path to TTF/OTF font file
  lineHeight?: number
}

/**
 * Measure text lines using fontkit (server-side)
 */
export async function measureTextLinesServer(
  options: ServerTextMeasurementOptions
): Promise<LineMeasurement[]> {
  const { text, fontSize, fontPath, lineHeight = 1.2 } = options

  try {
    // Load font file
    const fontBuffer = readFileSync(fontPath)
    const font = fontkit.create(fontBuffer)

    // Split by lines
    const lines = text.split('\n')
    const measurements: LineMeasurement[] = []

    for (const line of lines) {
      if (line.length === 0) {
        measurements.push({ text: line, width: 0 })
        continue
      }

      // Layout the text (handles ligatures, kerning, etc.)
      const run = font.layout(line)

      // Calculate width in pixels
      // Font units to pixels: (glyphUnits / unitsPerEm) * fontSize
      const widthInFontUnits = run.advanceWidth
      const widthInPixels = (widthInFontUnits / font.unitsPerEm) * fontSize

      measurements.push({
        text: line,
        width: widthInPixels,
      })
    }

    return measurements
  } catch (error) {
    console.error('Error measuring text with fontkit:', error)
    // Fallback to estimated width if font loading fails
    return text.split('\n').map((line) => ({
      text: line,
      width: line.length * fontSize * 0.6, // Rough estimate
    }))
  }
}

/**
 * Get common font paths for popular fonts
 */
export function getFontPath(fontFamily: string, weight: string | number = 'normal'): string {
  // Map common font families to file paths
  // You'll need to adjust these paths based on where fonts are stored
  const fontDir = join(process.cwd(), 'public', 'fonts')

  const fontMap: Record<string, Record<string, string>> = {
    Poppins: {
      normal: join(fontDir, 'Poppins-Regular.ttf'),
      bold: join(fontDir, 'Poppins-Bold.ttf'),
      '400': join(fontDir, 'Poppins-Regular.ttf'),
      '500': join(fontDir, 'Poppins-Medium.ttf'),
      '600': join(fontDir, 'Poppins-SemiBold.ttf'),
      '700': join(fontDir, 'Poppins-Bold.ttf'),
    },
    Inter: {
      normal: join(fontDir, 'Inter-Regular.ttf'),
      bold: join(fontDir, 'Inter-Bold.ttf'),
      '400': join(fontDir, 'Inter-Regular.ttf'),
      '500': join(fontDir, 'Inter-Medium.ttf'),
      '600': join(fontDir, 'Inter-SemiBold.ttf'),
      '700': join(fontDir, 'Inter-Bold.ttf'),
    },
  }

  const weightKey = String(weight)
  const family = fontMap[fontFamily]

  if (!family) {
    // Default fallback
    return join(fontDir, 'Poppins-Regular.ttf')
  }

  return family[weightKey] || family.normal
}

/**
 * Estimate text measurements (fallback when font file not available)
 */
export function estimateTextMeasurements(
  text: string,
  fontSize: number,
  fontFamily: string = 'Poppins'
): LineMeasurement[] {
  // Average character width multipliers for common fonts
  const charWidthMultipliers: Record<string, number> = {
    Poppins: 0.55,
    Inter: 0.52,
    Arial: 0.52,
    'Times New Roman': 0.48,
    Courier: 0.6,
  }

  const multiplier = charWidthMultipliers[fontFamily] || 0.55

  return text.split('\n').map((line) => ({
    text: line,
    width: line.length * fontSize * multiplier,
  }))
}
