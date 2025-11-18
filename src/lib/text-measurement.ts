/**
 * Text Measurement Utilities
 * Client-side DOM-based text measurement for blob generation
 */

export interface LineMeasurement {
  text: string
  width: number
}

export interface TextMeasurementOptions {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  lineHeight?: number
  maxWidth?: number
}

/**
 * Measure text dimensions using DOM APIs (client-side only)
 */
export function measureTextLines(options: TextMeasurementOptions): LineMeasurement[] {
  if (typeof window === 'undefined') {
    throw new Error('measureTextLines can only be used in browser environment')
  }

  const {
    text,
    fontSize,
    fontFamily,
    fontWeight = 'normal',
    fontStyle = 'normal',
    lineHeight = 1.2,
    maxWidth,
  } = options

  // Create temporary element for measurement
  const measureElement = document.createElement('div')
  measureElement.style.position = 'absolute'
  measureElement.style.visibility = 'hidden'
  measureElement.style.whiteSpace = 'pre'
  measureElement.style.fontSize = `${fontSize}px`
  measureElement.style.fontFamily = fontFamily
  measureElement.style.fontWeight = String(fontWeight)
  measureElement.style.fontStyle = fontStyle
  measureElement.style.lineHeight = String(lineHeight)
  measureElement.style.padding = '0'
  measureElement.style.margin = '0'
  measureElement.style.border = 'none'

  if (maxWidth) {
    measureElement.style.maxWidth = `${maxWidth}px`
    measureElement.style.whiteSpace = 'pre-wrap'
    measureElement.style.wordBreak = 'break-word'
  }

  document.body.appendChild(measureElement)

  try {
    // Split text by line breaks
    const lines = text.split('\n')
    const measurements: LineMeasurement[] = []

    for (const line of lines) {
      measureElement.textContent = line

      // Get bounding box (accounts for zoom/scale)
      const rect = measureElement.getBoundingClientRect()

      measurements.push({
        text: line,
        width: rect.width,
      })
    }

    return measurements
  } finally {
    // Clean up
    document.body.removeChild(measureElement)
  }
}

/**
 * Measure text with word wrapping
 */
export function measureTextWithWrapping(options: TextMeasurementOptions): LineMeasurement[] {
  if (typeof window === 'undefined') {
    throw new Error('measureTextWithWrapping can only be used in browser environment')
  }

  const {
    text,
    fontSize,
    fontFamily,
    fontWeight = 'normal',
    fontStyle = 'normal',
    lineHeight = 1.2,
    maxWidth,
  } = options

  // Create temporary element for measurement
  const measureElement = document.createElement('div')
  measureElement.style.position = 'absolute'
  measureElement.style.visibility = 'hidden'
  measureElement.style.fontSize = `${fontSize}px`
  measureElement.style.fontFamily = fontFamily
  measureElement.style.fontWeight = String(fontWeight)
  measureElement.style.fontStyle = fontStyle
  measureElement.style.lineHeight = String(lineHeight)
  measureElement.style.padding = '0'
  measureElement.style.margin = '0'
  measureElement.style.border = 'none'

  if (maxWidth) {
    measureElement.style.width = `${maxWidth}px`
    measureElement.style.whiteSpace = 'pre-wrap'
    measureElement.style.wordBreak = 'break-word'
  } else {
    measureElement.style.whiteSpace = 'pre'
  }

  measureElement.textContent = text
  document.body.appendChild(measureElement)

  try {
    const measurements: LineMeasurement[] = []

    // Use Range API to measure each line
    const range = document.createRange()
    const textNode = measureElement.firstChild

    if (!textNode) {
      return []
    }

    let currentOffset = 0
    let lineStart = 0
    let lastBottom = 0

    // Iterate through text to find line breaks
    for (let i = 0; i <= text.length; i++) {
      range.setStart(textNode, currentOffset)
      range.setEnd(textNode, i)

      const rect = range.getBoundingClientRect()

      // Detect line break (y position change)
      if (lastBottom > 0 && rect.bottom > lastBottom + 1) {
        // Measure the previous line
        range.setStart(textNode, lineStart)
        range.setEnd(textNode, currentOffset)

        const lineRect = range.getBoundingClientRect()
        const lineText = text.substring(lineStart, currentOffset)

        measurements.push({
          text: lineText,
          width: lineRect.width,
        })

        lineStart = currentOffset
      }

      currentOffset = i
      lastBottom = rect.bottom
    }

    // Add the last line
    if (lineStart < text.length) {
      range.setStart(textNode, lineStart)
      range.setEnd(textNode, text.length)

      const lineRect = range.getBoundingClientRect()
      const lineText = text.substring(lineStart)

      measurements.push({
        text: lineText,
        width: lineRect.width,
      })
    }

    return measurements
  } finally {
    // Clean up
    document.body.removeChild(measureElement)
  }
}

/**
 * Simple text width measurement using canvas (fallback)
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number = 'normal'
): number {
  if (typeof window === 'undefined') {
    return 0
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return 0
  }

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const metrics = context.measureText(text)

  return metrics.width
}
