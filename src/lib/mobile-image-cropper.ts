/**
 * Mobile Image Cropper Service
 *
 * Client-side image cropping to 3:4 aspect ratio (portrait) for TikTok sharing.
 * Uses HTML5 Canvas API to crop images with adjustable vertical positioning.
 */

const TARGET_WIDTH = 1080
const TARGET_HEIGHT = 1440
const TARGET_ASPECT_RATIO = TARGET_WIDTH / TARGET_HEIGHT // 0.75 (3:4 portrait)

/**
 * Load an image from URL with crossOrigin support
 */
async function loadImage(url: string, timeout = 10000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    const timeoutId = setTimeout(() => {
      reject(new Error('Image load timeout'))
    }, timeout)

    img.onload = () => {
      clearTimeout(timeoutId)
      resolve(img)
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      reject(new Error(`Failed to load image: ${url}`))
    }

    img.src = url
  })
}

/**
 * Crop an image to 3:4 aspect ratio portrait (1080x1440)
 *
 * @param imageUrl - The source image URL (presigned R2 URL)
 * @param offsetY - Vertical position offset (0.0 = top, 0.5 = center, 1.0 = bottom)
 * @returns PNG blob ready for sharing
 */
export async function cropImageTo3x4(
  imageUrl: string,
  offsetY: number = 0.5
): Promise<Blob> {
  // Clamp offsetY to valid range
  const clampedOffsetY = Math.max(0, Math.min(1, offsetY))

  // Load the source image
  const img = await loadImage(imageUrl)

  // Create canvas at target dimensions
  const canvas = document.createElement('canvas')
  canvas.width = TARGET_WIDTH
  canvas.height = TARGET_HEIGHT
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Calculate scaling to fit width
  const scale = TARGET_WIDTH / img.naturalWidth
  const scaledHeight = img.naturalHeight * scale

  // Calculate crop area
  if (scaledHeight <= TARGET_HEIGHT) {
    // Image is shorter than target - fit to height instead
    const scaleHeight = TARGET_HEIGHT / img.naturalHeight
    const scaledWidth = img.naturalWidth * scaleHeight

    // Center horizontally
    const offsetX = (TARGET_WIDTH - scaledWidth) / 2

    ctx.drawImage(img, offsetX, 0, scaledWidth, TARGET_HEIGHT)
  } else {
    // Image is taller than target - crop vertically based on offset
    const cropHeight = TARGET_HEIGHT / scale
    const maxCropY = img.naturalHeight - cropHeight
    const cropY = maxCropY * clampedOffsetY

    // Draw cropped portion to canvas
    ctx.drawImage(
      img,
      0, cropY,                    // Source x, y
      img.naturalWidth, cropHeight, // Source width, height
      0, 0,                         // Dest x, y
      TARGET_WIDTH, TARGET_HEIGHT   // Dest width, height
    )
  }

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      },
      'image/png',
      0.95 // Quality for PNG
    )
  })
}

/**
 * Calculate the vertical offset range for an image
 * Returns [min, max] where values outside this range won't change the crop
 */
export function getValidOffsetRange(imageWidth: number, imageHeight: number): [number, number] {
  const imageAspectRatio = imageWidth / imageHeight

  if (imageAspectRatio >= TARGET_ASPECT_RATIO) {
    // Image is wider - no vertical adjustment possible
    return [0.5, 0.5]
  }

  // Image is taller - full range available
  return [0, 1]
}

/**
 * Check if an image needs cropping for 3:4 portrait
 */
export function needsCropping(imageWidth: number, imageHeight: number): boolean {
  const imageAspectRatio = imageWidth / imageHeight
  const tolerance = 0.01

  return Math.abs(imageAspectRatio - TARGET_ASPECT_RATIO) > tolerance
}
