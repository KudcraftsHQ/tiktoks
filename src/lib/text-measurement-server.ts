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
 * Measure text lines using fontkit (server-side, synchronous)
 */
export function measureTextLinesSync(
  options: ServerTextMeasurementOptions
): LineMeasurement[] {
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
 * Only supports Poppins for now, using numeric weight naming (Poppins-400.ttf, etc.)
 */
export function getFontPath(fontFamily: string, weight: string | number = 400, style: string = 'normal'): string {
  const fontDir = join(process.cwd(), 'public', 'fonts', 'poppins')

  // Only support Poppins for now
  if (fontFamily !== 'Poppins') {
    console.warn(`Font family "${fontFamily}" not supported, falling back to Poppins`)
  }

  // Convert weight string to number
  let numericWeight = 400
  if (typeof weight === 'number') {
    numericWeight = weight
  } else if (typeof weight === 'string') {
    const weightMap: Record<string, number> = {
      thin: 100,
      extralight: 200,
      light: 300,
      normal: 400,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    }
    numericWeight = weightMap[weight.toLowerCase()] || parseInt(weight) || 400
  }

  // Clamp to available weights (400, 600, 700, 800)
  const availableWeights = [400, 600, 700, 800]
  if (!availableWeights.includes(numericWeight)) {
    // Find nearest available weight
    numericWeight = availableWeights.reduce((prev, curr) => {
      return Math.abs(curr - numericWeight) < Math.abs(prev - numericWeight) ? curr : prev
    })
  }

  // Build font file name: Poppins-400.ttf or Poppins-400italic.ttf
  const italic = style === 'italic' ? 'italic' : ''
  const fileName = `Poppins-${numericWeight}${italic}.ttf`

  return join(fontDir, fileName)
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
