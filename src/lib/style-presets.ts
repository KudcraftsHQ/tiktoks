import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

/**
 * Predefined text style presets for quick slide creation
 * Based on common TikTok carousel patterns
 */

export type StylePresetName = 'CENTERED_BOLD_BOX' | 'BOTTOM_CAPTION'

export const STYLE_PRESETS: Record<StylePresetName, Omit<RemixTextBoxType, 'id' | 'text'>> = {
  /**
   * Centered Bold Box - Main content style
   * White rounded box with bold black text, centered on canvas
   * Best for: Hook slides, main points, key messages
   */
  CENTERED_BOLD_BOX: {
    x: 0.1,
    y: 0.35,
    width: 0.8,
    height: 0.3,
    fontSize: 44,
    fontFamily: 'Poppins',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    textAlign: 'center',
    zIndex: 100,

    // Text wrapping
    textWrap: 'wrap',

    // Shadow effects (disabled)
    enableShadow: false,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // Outline effects (disabled)
    outlineWidth: 0,
    outlineColor: '#000000',

    // Legacy text styling
    textStroke: undefined,
    textShadow: undefined,
    borderWidth: 0,
    borderColor: '#000000',

    // Background styling
    backgroundColor: '#ffffff',
    backgroundOpacity: 1,
    borderRadius: 12,

    // Padding and spacing
    paddingTop: 24,
    paddingRight: 28,
    paddingBottom: 24,
    paddingLeft: 28,

    // Line height and letter spacing
    lineHeight: 1.3,
    letterSpacing: 0,
    wordSpacing: 0,

    // Transform
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0
    },
    lockAspectRatio: false
  },

  /**
   * Bottom Caption - CTA style
   * White rounded box at bottom of canvas with slightly smaller text
   * Best for: Call-to-action slides, final messages, footer content
   */
  BOTTOM_CAPTION: {
    x: 0.1,
    y: 0.75,
    width: 0.8,
    height: 0.2,
    fontSize: 36,
    fontFamily: 'Poppins',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
    textAlign: 'center',
    zIndex: 100,

    // Text wrapping
    textWrap: 'wrap',

    // Shadow effects (disabled)
    enableShadow: false,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // Outline effects (disabled)
    outlineWidth: 0,
    outlineColor: '#000000',

    // Legacy text styling
    textStroke: undefined,
    textShadow: undefined,
    borderWidth: 0,
    borderColor: '#000000',

    // Background styling
    backgroundColor: '#ffffff',
    backgroundOpacity: 1,
    borderRadius: 12,

    // Padding and spacing
    paddingTop: 16,
    paddingRight: 24,
    paddingBottom: 16,
    paddingLeft: 24,

    // Line height and letter spacing
    lineHeight: 1.2,
    letterSpacing: 0,
    wordSpacing: 0,

    // Transform
    transform: {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0
    },
    lockAspectRatio: false
  }
}

/**
 * Helper to create a text box from a preset
 */
export function createTextBoxFromPreset(
  preset: StylePresetName,
  text: string,
  id?: string
): RemixTextBoxType {
  return {
    id: id || `text_${Date.now()}`,
    text,
    ...STYLE_PRESETS[preset]
  }
}

/**
 * Analyze text and suggest best preset based on content
 */
export interface TextMetrics {
  characterCount: number
  wordCount: number
  estimatedLines: number
  hasLineBreaks: boolean
  longestWord: number
}

export function analyzeText(
  text: string,
  fontSize: number = 44,
  boxWidth: number = 0.8,
  canvasWidth: number = 1080
): TextMetrics {
  const actualWidth = canvasWidth * boxWidth
  const charsPerLine = Math.floor(actualWidth / (fontSize * 0.6))
  const words = text.split(/\s+/).filter(w => w.length > 0)

  return {
    characterCount: text.length,
    wordCount: words.length,
    estimatedLines: Math.ceil(text.length / charsPerLine),
    hasLineBreaks: text.includes('\n'),
    longestWord: Math.max(...words.map(w => w.length), 0)
  }
}

/**
 * Suggest optimal text box configuration based on text length and slide type
 */
export function suggestLayout(
  text: string,
  slideType: 'Hook' | 'Content' | 'CTA',
  canvasWidth: number = 1080,
  canvasHeight: number = 1920
): RemixTextBoxType {
  const basePreset = slideType === 'CTA'
    ? STYLE_PRESETS.BOTTOM_CAPTION
    : STYLE_PRESETS.CENTERED_BOLD_BOX

  const metrics = analyzeText(text, basePreset.fontSize, basePreset.width, canvasWidth)

  // Short text (< 50 chars) → Larger font, more centered
  if (metrics.characterCount < 50) {
    return createTextBoxFromPreset(
      slideType === 'CTA' ? 'BOTTOM_CAPTION' : 'CENTERED_BOLD_BOX',
      text,
      `text_${Date.now()}`
    )
  }

  // Medium text (50-120 chars) → Standard preset
  if (metrics.characterCount < 120) {
    return createTextBoxFromPreset(
      slideType === 'CTA' ? 'BOTTOM_CAPTION' : 'CENTERED_BOLD_BOX',
      text,
      `text_${Date.now()}`
    )
  }

  // Long text (> 120 chars) → Smaller font, more width, adjust height
  const longTextPreset = {
    ...basePreset,
    fontSize: 36,
    width: 0.85,
    height: 0.35,
    paddingTop: 20,
    paddingBottom: 20,
    lineHeight: 1.25
  }

  return {
    id: `text_${Date.now()}`,
    text,
    ...longTextPreset
  }
}

/**
 * Calculate text box height based on content
 */
export function calculateTextBoxHeight(
  text: string,
  fontSize: number,
  boxWidth: number,
  lineHeight: number = 1.2,
  paddingTop: number = 24,
  paddingBottom: number = 24,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920
): number {
  const metrics = analyzeText(text, fontSize, boxWidth, canvasWidth)

  const textHeight = metrics.estimatedLines * fontSize * lineHeight
  const totalHeight = textHeight + paddingTop + paddingBottom

  // Return as proportion of canvas height
  return Math.min(totalHeight / canvasHeight, 0.9) // Max 90% of canvas
}
