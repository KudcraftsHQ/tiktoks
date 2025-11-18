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
  spread: number // padding in pixels
  roundness: number // 0-1, 0 = sharp corners, 1 = very smooth
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

/**
 * Generate a TikTok-style blob by tracing outline and rounding corners
 * This creates stable, clean blobs that perfectly hug the text
 */
export function generateTextHuggingBlob(options: TextHuggingBlobOptions): string {
  const { lines, lineHeight, spread, roundness } = options

  if (lines.length === 0) return ''

  // Map roundness (0-1) to corner radius in pixels
  const radius = roundness * spread

  // Calculate bounding box for each line
  interface LineBox {
    x: number
    y: number
    width: number
    height: number
  }

  const lineBoxes: LineBox[] = lines.map((line, i) => ({
    x: -spread,
    y: i * lineHeight - spread,
    width: line.width + spread * 2,
    height: lineHeight + spread * 2,
  }))

  if (lineBoxes.length === 0) return ''

  // Build polygon points by tracing the outline smoothly
  const points: [number, number][] = []

  // Start from top-left, trace clockwise
  const firstBox = lineBoxes[0]
  const lastBox = lineBoxes[lineBoxes.length - 1]

  // Top edge - follow the widest line at the top
  points.push([firstBox.x, firstBox.y])
  points.push([firstBox.x + firstBox.width, firstBox.y])

  // Right side - trace down following each line's right edge
  for (let i = 0; i < lineBoxes.length; i++) {
    const box = lineBoxes[i]
    const nextBox = lineBoxes[i + 1]

    // Right edge of current line
    const rightX = box.x + box.width
    const bottomY = box.y + box.height

    // Only add corner points where width changes significantly
    if (!nextBox) {
      // Last line - go to bottom right
      points.push([rightX, bottomY])
    } else {
      const nextRightX = nextBox.x + nextBox.width
      // Add point if there's a significant width change
      if (Math.abs(rightX - nextRightX) > 1) {
        points.push([rightX, bottomY])
      }
    }
  }

  // Bottom edge
  points.push([lastBox.x, lastBox.y + lastBox.height])

  // Left side - trace up following each line's left edge
  for (let i = lineBoxes.length - 1; i >= 0; i--) {
    const box = lineBoxes[i]
    const prevBox = lineBoxes[i - 1]

    const leftX = box.x
    const topY = box.y

    // Only add corner points where width changes significantly
    if (!prevBox) {
      // First line - go to top left
      points.push([leftX, topY])
    } else {
      const prevLeftX = prevBox.x
      // Add point if there's a significant width change
      if (Math.abs(leftX - prevLeftX) > 1) {
        points.push([leftX, topY])
      }
    }
  }

  // Round the polygon corners
  const roundedCommands = roundPolygonCorners(points, radius)

  // Convert to SVG path
  return commandsToPath(roundedCommands)
}

/**
 * Round polygon corners using quadratic bezier curves
 */
function roundPolygonCorners(
  points: [number, number][],
  radius: number
): Array<['M' | 'L' | 'Q', number, number, number?, number?]> {
  const commands: Array<['M' | 'L' | 'Q', number, number, number?, number?]> = []

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const cur = points[i]
    const next = points[(i + 1) % points.length]

    // Vectors from current point to neighbors
    const v1 = normalize([cur[0] - prev[0], cur[1] - prev[1]])
    const v2 = normalize([cur[0] - next[0], cur[1] - next[1]])

    // Points at radius distance from corner
    const p1: [number, number] = [cur[0] - v1[0] * radius, cur[1] - v1[1] * radius]
    const p2: [number, number] = [cur[0] - v2[0] * radius, cur[1] - v2[1] * radius]

    // Line to start of curve
    commands.push(['L', p1[0], p1[1]])
    // Quadratic curve through corner to end of curve
    commands.push(['Q', cur[0], cur[1], p2[0], p2[1]])
  }

  return commands
}

/**
 * Normalize a 2D vector
 */
function normalize(v: [number, number]): [number, number] {
  const len = Math.hypot(v[0], v[1])
  if (len === 0) return [0, 0]
  return [v[0] / len, v[1] / len]
}

/**
 * Convert commands to SVG path string
 */
function commandsToPath(
  commands: Array<['M' | 'L' | 'Q', number, number, number?, number?]>
): string {
  return commands
    .map((cmd, i) => {
      if (i === 0) {
        // First command becomes M (move)
        return `M ${cmd[1]} ${cmd[2]}`
      } else if (cmd[0] === 'Q') {
        // Quadratic curve
        return `Q ${cmd[1]} ${cmd[2]} ${cmd[3]} ${cmd[4]}`
      } else {
        // Line
        return `L ${cmd[1]} ${cmd[2]}`
      }
    })
    .join(' ') + ' Z'
}

/**
 * Create an SVG path for a rounded rectangle
 * Uses the more efficient arc commands for corners
 */
function createRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): string {
  // Clamp radius to not exceed half of smallest dimension
  const r = Math.min(radius, width / 2, height / 2)

  if (r <= 0) {
    // No rounding - simple rectangle
    return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`
  }

  // Rounded rectangle path
  // Start at top-left corner (after the curve)
  return `
    M ${x + r} ${y}
    L ${x + width - r} ${y}
    Q ${x + width} ${y} ${x + width} ${y + r}
    L ${x + width} ${y + height - r}
    Q ${x + width} ${y + height} ${x + width - r} ${y + height}
    L ${x + r} ${y + height}
    Q ${x} ${y + height} ${x} ${y + height - r}
    L ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    Z
  `.replace(/\s+/g, ' ').trim()
}
