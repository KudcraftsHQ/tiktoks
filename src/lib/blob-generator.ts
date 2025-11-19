/**
 * Blob SVG Path Generator
 * Generates organic blob shapes for text backgrounds
 */

export interface BlobOptions {
  seed?: number
  complexity?: number
  contrast?: number
}

export interface TextHuggingBlobOptions {
  lines: Array<{ text: string; width: number }>
  lineHeight: number
  fontSize?: number // Added to calculate vertical centering
  spread: number // padding in pixels
  roundness: number // 0-1, 0 = sharp corners, 1 = very smooth
  align?: 'left' | 'center' | 'right'
  containerWidth?: number // Explicit container width for true CSS-like alignment
}

/**
 * Predefined blob paths for consistent styling
 * These are normalized to a 200x200 viewBox
 */
export const BLOB_PRESETS = {
  blob1: 'M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C87,14.6,81.4,29.1,73.1,42.3C64.8,55.5,53.8,67.3,40.3,75.4C26.8,83.5,11.1,88,-4.2,88.9C-19.5,89.8,-34.9,87.2,-48.3,79.5C-61.7,71.8,-72.9,58.9,-80.3,44.5C-87.7,30.1,-91.3,15.1,-90.1,0.5C-88.9,-14.2,-82.8,-28.3,-74.3,-41.2C-65.9,-54.1,-55,-65.7,-41.8,-73.3C-28.6,-80.9,-14.3,-84.4,0.1,-84.6C14.6,-84.7,29.1,-81.6,44.7,-76.4Z',

  blob2: 'M39.5,-65.9C52.1,-58.6,64.1,-50.2,70.4,-38.5C76.7,-26.8,77.3,-11.8,75.6,2.3C73.9,16.4,69.9,29.6,62.3,40.2C54.7,50.8,43.5,58.8,31.2,64.4C18.9,70,5.5,73.2,-8.1,73.3C-21.7,73.4,-35.6,70.4,-47.3,63.5C-59,56.6,-68.5,45.8,-74.4,33.2C-80.3,20.6,-82.6,6.2,-81.1,-7.8C-79.6,-21.8,-74.3,-35.4,-65.5,-46.2C-56.7,-57,-44.4,-65,-31.7,-71.3C-19,-77.6,-6,-82.2,5.8,-80.9C17.6,-79.6,26.9,-73.2,39.5,-65.9Z',

  blob3: 'M37.3,-63.5C48.9,-56.3,59.4,-47.3,66.2,-35.8C73,-24.3,76.1,-10.3,75.8,3.6C75.5,17.5,71.8,31.3,64.3,43.2C56.8,55.1,45.5,65.1,32.5,71.4C19.5,77.7,4.8,80.3,-9.4,79.3C-23.6,78.3,-37.3,73.7,-49.2,66.2C-61.1,58.7,-71.2,48.3,-77.4,35.9C-83.6,23.5,-85.9,9.1,-84.3,-4.6C-82.7,-18.3,-77.2,-31.3,-68.9,-42.5C-60.6,-53.7,-49.5,-63.1,-37.2,-69.8C-24.9,-76.5,-11.2,-80.5,1.3,-80.1C13.8,-79.7,25.7,-70.7,37.3,-63.5Z',

  blob4: 'M41.2,-71.8C54.2,-64.3,66.1,-55.2,72.8,-43.1C79.5,-31,81,-16,79.3,-1.8C77.6,12.4,72.7,25.9,65.3,37.8C57.9,49.7,48,60,36.3,66.8C24.6,73.6,11.1,76.9,-2.8,76.3C-16.7,75.7,-30.8,71.2,-43.2,64.1C-55.6,57,-66.3,47.3,-73.2,35.3C-80.1,23.3,-83.2,9,-82.3,-5.1C-81.4,-19.2,-76.5,-33.1,-68.1,-44.7C-59.7,-56.3,-47.8,-65.6,-34.9,-73.1C-22,-80.6,-8.1,-86.3,4.6,-85.8C17.3,-85.3,28.2,-79.3,41.2,-71.8Z',

  blob5: 'M35.4,-59.7C46.8,-51.3,57.7,-43.2,64.9,-31.9C72.1,-20.6,75.6,-6.1,74.7,7.9C73.8,21.9,68.5,35.4,59.8,46.2C51.1,57,39,65.1,25.8,70.4C12.6,75.7,-1.7,78.2,-15.5,76.3C-29.3,74.4,-42.6,68.1,-54.2,58.9C-65.8,49.7,-75.7,37.6,-80.5,23.8C-85.3,10,-85,(-5.5),-80.3,-19.4C-75.6,-33.3,-66.5,-45.6,-55.1,-54.2C-43.7,-62.8,-30,-67.7,-16.8,-70.9C-3.6,-74.1,9.1,-75.6,21.1,-73.5C33.1,-71.4,44.4,-65.7,35.4,-59.7Z',
} as const

export type BlobPresetName = keyof typeof BLOB_PRESETS

/**
 * Generate a random blob path using a simple algorithm
 */
export function generateBlobPath(options: BlobOptions = {}): string {
  const { seed = Math.random(), complexity = 8, contrast = 0.5 } = options

  const points: { x: number; y: number }[] = []
  const angleStep = (Math.PI * 2) / complexity

  // Generate points in a circle with random variations
  for (let i = 0; i < complexity; i++) {
    const angle = i * angleStep
    const randomRadius = 50 + (Math.sin(seed * 1000 + i) * 30 * contrast)

    const x = 100 + Math.cos(angle) * randomRadius
    const y = 100 + Math.sin(angle) * randomRadius

    points.push({ x, y })
  }

  // Create smooth cubic bezier path
  let path = `M ${points[0].x},${points[0].y}`

  for (let i = 0; i < points.length; i++) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const nextNext = points[(i + 2) % points.length]

    // Calculate control points for smooth curves
    const cp1x = current.x + (next.x - current.x) * 0.5
    const cp1y = current.y + (next.y - current.y) * 0.5
    const cp2x = next.x - (nextNext.x - next.x) * 0.3
    const cp2y = next.y - (nextNext.y - next.y) * 0.3

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }

  path += ' Z'

  return path
}

/**
 * Get a blob path by preset name or generate a new one
 */
export function getBlobPath(preset?: BlobPresetName, options?: BlobOptions): string {
  if (preset && BLOB_PRESETS[preset]) {
    return BLOB_PRESETS[preset]
  }

  return generateBlobPath(options)
}

/**
 * Get list of available blob presets
 */
export function getBlobPresetNames(): BlobPresetName[] {
  return Object.keys(BLOB_PRESETS) as BlobPresetName[]
}

/**
 * Transform blob path to fit specific dimensions
 * Blobs are normalized to 200x200, this scales them
 */
export function scaleBlobPath(path: string, scale: number): string {
  // Simple approach: wrap in a transform
  // For more complex scaling, you'd parse and modify the path
  return path
}

import polygonClipping from 'polygon-clipping'

/**
 * Generate a TikTok-style blob by constructing sharp rectangles for each line,
 * unioning them, and then applying smoothing to all corners (both convex and concave).
 * This creates the "gooey" look where lines merge smoothly.
 */
export function generateTextHuggingBlob(options: TextHuggingBlobOptions): string {
  const { lines, lineHeight, fontSize, spread, roundness, align = 'left', containerWidth } = options

  if (lines.length === 0) return ''

  // Map roundness (0-1) to corner radius in pixels
  const maxRadius = (lineHeight + spread * 2) / 2
  const radius = roundness * maxRadius

  const maxLineWidth = Math.max(...lines.map(l => l.width))
  const referenceWidth = containerWidth ?? maxLineWidth
  
  // Calculate vertical offset to center blob on text content
  // Standard CSS line-height places 'half-leading' above and below the text
  // We want the blob to hug the text content (fontSize), not the full line box
  const actualFontSize = fontSize || lineHeight
  const verticalOffset = (lineHeight - actualFontSize) / 2

  // 1. Generate SHARP rectangular polygons for each line
  const linePolygons: Array<[number, number][]> = lines.map((line, i) => {
    let x = 0

    if (align === 'center') {
      x = (referenceWidth - line.width) / 2
    } else if (align === 'right') {
      x = (referenceWidth - line.width)
    } else {
      x = 0
    }

    // Calculate y and height to center strictly on the text content + spread
    // This creates steps that align with the text baseline/cap-height rather than line boxes
    const y = i * lineHeight + verticalOffset
    const height = actualFontSize + spread * 2
    const width = line.width + spread * 2

    // Return sharp rectangle points (clockwise)
    return [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ]
  })

  if (linePolygons.length === 0) return ''

  try {
    // 2. Union all sharp polygons together
    const inputPolygons = linePolygons.map(poly => [poly] as [number, number][][])
    
    // Perform the union to get a single stepped polygon
    const mergedPolygons = polygonClipping.union(inputPolygons as any)

    if (mergedPolygons.length === 0) return ''

    // 3. Smooth the polygon
    // We assume the first polygon is the main one (standard case)
    // If there are disjoint islands, we map over all of them
    return mergedPolygons.map(multiPoly => {
      return multiPoly.map(ring => {
        // ring is Array<[number, number]> (last point == first point usually)
        // polygon-clipping returns closed rings
        return smoothPolygon(ring, radius)
      }).join(' ')
    }).join(' ')

  } catch (e) {
    console.error('Error generating blob:', e)
    // Fallback
    const totalHeight = lines.length * lineHeight + spread * 2
    const maxWidth = referenceWidth + spread * 2
    return `M 0 0 L ${maxWidth} 0 L ${maxWidth} ${totalHeight} L 0 ${totalHeight} Z`
  }
}

/**
 * Smoothes a polygon by replacing sharp corners with quadratic bezier curves.
 * 
 * @param points Array of [x, y] points forming a closed loop
 * @param radius The desired corner radius
 */
function smoothPolygon(points: [number, number][], radius: number): string {
  // Remove the last point if it's identical to the first (polygon-clipping returns closed loops)
  const uniquePoints = [...points]
  if (uniquePoints.length > 1 && 
      uniquePoints[0][0] === uniquePoints[uniquePoints.length - 1][0] && 
      uniquePoints[0][1] === uniquePoints[uniquePoints.length - 1][1]) {
    uniquePoints.pop()
  }

  if (uniquePoints.length < 3) return ''

  let path = ''
  const len = uniquePoints.length

  for (let i = 0; i < len; i++) {
    const curr = uniquePoints[i]
    const prev = uniquePoints[(i - 1 + len) % len]
    const next = uniquePoints[(i + 1) % len]

    // Vectors
    const vPrev = { x: curr[0] - prev[0], y: curr[1] - prev[1] }
    const vNext = { x: next[0] - curr[0], y: next[1] - curr[1] }

    const lenPrev = Math.sqrt(vPrev.x * vPrev.x + vPrev.y * vPrev.y)
    const lenNext = Math.sqrt(vNext.x * vNext.x + vNext.y * vNext.y)

    // Limit radius to half the length of the shortest adjacent leg
    // This prevents curve overlap
    const r = Math.min(radius, lenPrev / 2, lenNext / 2)

    // Calculate start and end points of the curve
    // Start is on the segment coming FROM prev
    const start = {
      x: curr[0] - (vPrev.x / lenPrev) * r,
      y: curr[1] - (vPrev.y / lenPrev) * r
    }

    // End is on the segment going TO next
    const end = {
      x: curr[0] + (vNext.x / lenNext) * r,
      y: curr[1] + (vNext.y / lenNext) * r
    }

    if (i === 0) {
      path += `M ${start.x} ${start.y}`
    } else {
      path += ` L ${start.x} ${start.y}`
    }

    // Quadratic curve to 'end' using 'curr' as control point
    path += ` Q ${curr[0]} ${curr[1]} ${end.x} ${end.y}`
  }

  path += ' Z'
  return path
}


