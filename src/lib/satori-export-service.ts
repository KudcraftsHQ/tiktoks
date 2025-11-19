/**
 * Satori Export Service
 * Handles conversion of slides to images using Satori + resvg-js
 */

import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { fontLoader } from './font-loader'
import { renderSlideToJSX, type SlideData } from './satori-renderer'

export interface ExportOptions {
  format?: 'png' | 'jpeg'
  quality?: number
  width?: number
  height?: number
}

class SatoriExportService {
  private fontsInitialized = false

  /**
   * Initialize fonts (download if needed)
   */
  private async ensureFontsLoaded() {
    if (!this.fontsInitialized) {
      console.log('🎨 [Satori] Ensuring fonts are loaded...')
      // Download essential fonts if not already present
      await fontLoader.getEssentialFonts()
      this.fontsInitialized = true
      console.log('✅ [Satori] Fonts loaded')
    }
  }

  /**
   * Export slide to PNG/JPEG buffer using Satori
   */
  async exportSlide(slide: SlideData, options: ExportOptions = {}): Promise<Buffer> {
    const {
      format = 'png',
      quality = 0.95,
      width = slide.canvas.width,
      height = slide.canvas.height,
    } = options

    console.log('🎨 [Satori] Starting export...')
    console.log('🎨 [Satori] Canvas size:', { width, height })
    console.log('🎨 [Satori] Format:', format, 'Quality:', quality)

    // Ensure fonts are loaded
    await this.ensureFontsLoaded()

    // Load fonts for Satori
    // Get the font weights used in text boxes
    const fontWeights = new Set<number>()
    const fontStyles = new Set<'normal' | 'italic'>()

    slide.textBoxes.forEach((tb) => {
      const weight = typeof tb.fontWeight === 'string' ? this.parseFontWeight(tb.fontWeight) : tb.fontWeight
      fontWeights.add(weight)
      fontStyles.add(tb.fontStyle)
    })

    // Ensure we have at least regular weight
    if (fontWeights.size === 0) {
      fontWeights.add(400)
    }

    // Load required fonts
    console.log('🎨 [Satori] Loading fonts:', Array.from(fontWeights), Array.from(fontStyles))
    const fonts = await fontLoader.getFonts(
      Array.from(fontWeights) as any,
      fontStyles.has('italic')
    )

    console.log('🎨 [Satori] Fonts loaded:', fonts.length, 'variants')

    // Render slide to JSX
    console.log('🎨 [Satori] Rendering slide to JSX...')
    const jsx = renderSlideToJSX(slide)

    // Convert JSX to SVG using Satori
    console.log('🎨 [Satori] Converting JSX to SVG...')
    console.log('🎨 [Satori] Font data:', fonts.map(f => ({ name: f.name, weight: f.weight, style: f.style })))

    // Debug: Log the JSX structure to see what we're passing to Satori
    try {
      console.log('🎨 [Satori] JSX props:', JSON.stringify(jsx.props, null, 2))
    } catch (e) {
      console.log('🎨 [Satori] Could not stringify JSX props')
    }

    const svg = await satori(jsx, {
      width,
      height,
      fonts,
    })

    console.log('✅ [Satori] SVG generated:', svg.length, 'characters')

    // Convert SVG to PNG using resvg
    console.log('🎨 [Satori] Converting SVG to PNG...')
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: width,
      },
    })

    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    console.log('✅ [Satori] PNG generated:', pngBuffer.length, 'bytes')

    // For JPEG, we'd need to convert PNG to JPEG
    // For now, we'll just return PNG
    if (format === 'jpeg') {
      console.warn('⚠️ [Satori] JPEG format not yet implemented, returning PNG')
    }

    return pngBuffer
  }

  /**
   * Parse font weight string to number
   */
  private parseFontWeight(weight: string | number | undefined | null): number {
    // Handle undefined/null/empty values
    if (!weight || (typeof weight === 'string' && weight.trim() === '')) {
      return 400 // Default to regular weight
    }

    // If already a number, return it
    if (typeof weight === 'number') {
      return weight
    }

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

    const normalized = weight.toLowerCase().trim()
    return weightMap[normalized] || parseInt(weight) || 400
  }

  /**
   * Clear font cache
   */
  clearCache() {
    fontLoader.clearCache()
    this.fontsInitialized = false
    console.log('🗑️ [Satori] Cache cleared')
  }
}

// Export singleton instance
export const satoriExportService = new SatoriExportService()
