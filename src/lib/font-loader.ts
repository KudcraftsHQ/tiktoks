/**
 * Font Loader Service
 * Handles loading Poppins fonts for Satori rendering
 */

import fs from 'fs'
import path from 'path'

export type PoppinsWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type PoppinsStyle = 'normal' | 'italic'

export interface FontData {
  name: string
  data: ArrayBuffer
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  style: 'normal' | 'italic'
}

// Google Fonts URLs for Poppins
const POPPINS_FONT_URLS: Record<string, string> = {
  'Poppins-100': 'https://fonts.gstatic.com/s/poppins/v21/pxiGyp8kv8JHgFVrLPTed3FBGPaTSQ.ttf',
  'Poppins-100italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiAyp8kv8JHgFVrJJLmE3tFOvODSVFF.ttf',
  'Poppins-200': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLFj_V1tvFP-KUEg.ttf',
  'Poppins-200italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLmv1plEN2PQEhcqw.ttf',
  'Poppins-300': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLDz8V1tvFP-KUEg.ttf',
  'Poppins-300italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLm21llEN2PQEhcqw.ttf',
  'Poppins-400': 'https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrFJDUc1NECPY.ttf',
  'Poppins-400italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiGyp8kv8JHgFVrJJLed3FBGPaTSQ.ttf',
  'Poppins-500': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLGT9V1tvFP-KUEg.ttf',
  'Poppins-500italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLmg1hlEN2PQEhcqw.ttf',
  'Poppins-600': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLEj6V1tvFP-KUEg.ttf',
  'Poppins-600italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLmr19lEN2PQEhcqw.ttf',
  'Poppins-700': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf',
  'Poppins-700italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLmy15lEN2PQEhcqw.ttf',
  'Poppins-800': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLDD4V1tvFP-KUEg.ttf',
  'Poppins-800italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLm111lEN2PQEhcqw.ttf',
  'Poppins-900': 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLBT5V1tvFP-KUEg.ttf',
  'Poppins-900italic': 'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLm81xlEN2PQEhcqw.ttf',
}

class FontLoaderService {
  private fontsDir: string
  private fontCache: Map<string, ArrayBuffer> = new Map()
  private downloadedFonts: Set<string> = new Set()

  constructor() {
    this.fontsDir = path.join(process.cwd(), 'public', 'fonts', 'poppins')
  }

  /**
   * Get font key for caching
   */
  private getFontKey(weight: PoppinsWeight, style: PoppinsStyle): string {
    return `Poppins-${weight}${style === 'italic' ? 'italic' : ''}`
  }

  /**
   * Get file path for a font
   */
  private getFontPath(weight: PoppinsWeight, style: PoppinsStyle): string {
    const key = this.getFontKey(weight, style)
    return path.join(this.fontsDir, `${key}.ttf`)
  }

  /**
   * Download a single font from Google Fonts
   */
  private async downloadFont(weight: PoppinsWeight, style: PoppinsStyle): Promise<void> {
    const key = this.getFontKey(weight, style)

    if (this.downloadedFonts.has(key)) {
      return
    }

    const url = POPPINS_FONT_URLS[key]
    if (!url) {
      throw new Error(`Font not found: ${key}`)
    }

    const fontPath = this.getFontPath(weight, style)

    // Check if already downloaded
    if (fs.existsSync(fontPath)) {
      this.downloadedFonts.add(key)
      return
    }

    console.log(`📥 Downloading ${key}...`)

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download font: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Ensure directory exists
      fs.mkdirSync(this.fontsDir, { recursive: true })

      // Write font file
      fs.writeFileSync(fontPath, buffer)

      this.downloadedFonts.add(key)
      console.log(`✅ Downloaded ${key}`)
    } catch (error) {
      console.error(`❌ Failed to download ${key}:`, error)
      throw error
    }
  }

  /**
   * Load a font file as ArrayBuffer
   */
  private async loadFontFile(weight: PoppinsWeight, style: PoppinsStyle): Promise<ArrayBuffer> {
    const key = this.getFontKey(weight, style)

    // Check cache first
    if (this.fontCache.has(key)) {
      return this.fontCache.get(key)!
    }

    // Ensure font is downloaded
    await this.downloadFont(weight, style)

    const fontPath = this.getFontPath(weight, style)
    const buffer = fs.readFileSync(fontPath)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

    // Cache it
    this.fontCache.set(key, arrayBuffer)

    return arrayBuffer
  }

  /**
   * Get font data for Satori
   */
  async getFontData(weight: PoppinsWeight = 400, style: PoppinsStyle = 'normal'): Promise<FontData> {
    const data = await this.loadFontFile(weight, style)

    return {
      name: 'Poppins',
      data,
      weight,
      style
    }
  }

  /**
   * Get multiple font weights for Satori
   */
  async getFonts(weights: PoppinsWeight[], includeItalic = true): Promise<FontData[]> {
    const fonts: FontData[] = []

    for (const weight of weights) {
      // Load regular weight
      fonts.push(await this.getFontData(weight, 'normal'))

      // Load italic variant
      if (includeItalic) {
        fonts.push(await this.getFontData(weight, 'italic'))
      }
    }

    return fonts
  }

  /**
   * Get all Poppins font weights (100-900) with italics
   */
  async getAllFonts(): Promise<FontData[]> {
    const weights: PoppinsWeight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900]
    return this.getFonts(weights, true)
  }

  /**
   * Get essential fonts (regular, bold, and their italics)
   */
  async getEssentialFonts(): Promise<FontData[]> {
    const weights: PoppinsWeight[] = [400, 600, 700]
    return this.getFonts(weights, true)
  }

  /**
   * Download all Poppins fonts at once
   */
  async downloadAllFonts(): Promise<void> {
    console.log('📥 Downloading all Poppins fonts...')
    const weights: PoppinsWeight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900]

    const downloadPromises: Promise<void>[] = []

    for (const weight of weights) {
      downloadPromises.push(this.downloadFont(weight, 'normal'))
      downloadPromises.push(this.downloadFont(weight, 'italic'))
    }

    await Promise.all(downloadPromises)
    console.log('✅ All Poppins fonts downloaded')
  }

  /**
   * Clear font cache
   */
  clearCache(): void {
    this.fontCache.clear()
    console.log('🗑️ Font cache cleared')
  }
}

// Export singleton instance
export const fontLoader = new FontLoaderService()
