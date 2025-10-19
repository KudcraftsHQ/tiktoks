/**
 * File Type Detector
 *
 * Utility functions to detect file types from buffer magic bytes
 * and provide detailed file analysis for debugging
 */

export interface FileTypeInfo {
  format: string
  mimeType: string
  confidence: 'high' | 'medium' | 'low'
  description: string
  magicBytes?: string[]
}

export interface FileAnalysis {
  detectedType: FileTypeInfo
  expectedFromExtension?: string
  isMismatch: boolean
  bufferSize: number
  headerHex: string
  metadata: Record<string, any>
}

// Magic byte signatures for common image formats
const SIGNATURES: Record<string, FileTypeInfo> = {
  // JPEG
  'ffd8ff': {
    format: 'JPEG',
    mimeType: 'image/jpeg',
    confidence: 'high',
    description: 'JPEG image format',
    magicBytes: ['ffd8ff']
  },
  
  // PNG
  '89504e47': {
    format: 'PNG',
    mimeType: 'image/png',
    confidence: 'high',
    description: 'PNG image format',
    magicBytes: ['89504e47']
  },
  
  // WebP
  '52494646': {
    format: 'WebP',
    mimeType: 'image/webp',
    confidence: 'medium',
    description: 'WebP image format (RIFF container)',
    magicBytes: ['52494646']
  },
  
  // GIF
  '47494638': {
    format: 'GIF',
    mimeType: 'image/gif',
    confidence: 'high',
    description: 'GIF image format',
    magicBytes: ['47494638']
  },
  
  // HEIC/HEIF (ftyp box)
  '66747970': {
    format: 'HEIC/HEIF',
    mimeType: 'image/heic',
    confidence: 'high',
    description: 'HEIC/HEIF image format',
    magicBytes: ['66747970']
  },
  
  // BMP
  '424d': {
    format: 'BMP',
    mimeType: 'image/bmp',
    confidence: 'high',
    description: 'Bitmap image format',
    magicBytes: ['424d']
  },
  
  // TIFF (little endian)
  '49492a00': {
    format: 'TIFF',
    mimeType: 'image/tiff',
    confidence: 'high',
    description: 'TIFF image format (little endian)',
    magicBytes: ['49492a00']
  },
  
  // TIFF (big endian)
  '4d4d002a': {
    format: 'TIFF',
    mimeType: 'image/tiff',
    confidence: 'high',
    description: 'TIFF image format (big endian)',
    magicBytes: ['4d4d002a']
  }
}

/**
 * Get file extension from string
 */
function getFileExtension(filename?: string): string | null {
  if (!filename) return null
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return null
  return filename.substring(lastDot + 1).toLowerCase()
}

/**
 * Get expected format from file extension
 */
function getExpectedFormatFromExtension(extension: string): FileTypeInfo | null {
  const extensionMap: Record<string, FileTypeInfo> = {
    'jpg': SIGNATURES['ffd8ff'],
    'jpeg': SIGNATURES['ffd8ff'],
    'png': SIGNATURES['89504e47'],
    'webp': SIGNATURES['52494646'],
    'gif': SIGNATURES['47494638'],
    'heic': SIGNATURES['66747970'],
    'heif': SIGNATURES['66747yp70'],
    'bmp': SIGNATURES['424d'],
    'tiff': SIGNATURES['49492a00'],
    'tif': SIGNATURES['49492a00']
  }
  
  return extensionMap[extension] || null
}

/**
 * Extract first 16 bytes as hex string
 */
function getHeaderHex(buffer: Buffer): string {
  const headerSize = Math.min(16, buffer.length)
  return buffer.subarray(0, headerSize).toString('hex').toLowerCase()
}

/**
 * Detect file type from buffer magic bytes
 */
function detectFromMagicBytes(buffer: Buffer): FileTypeInfo | null {
  if (buffer.length < 4) return null
  
  const headerHex = getHeaderHex(buffer)
  
  // Check each signature
  for (const [signature, typeInfo] of Object.entries(SIGNATURES)) {
    if (headerHex.startsWith(signature)) {
      // Additional check for WebP (needs RIFF + WebP)
      if (typeInfo.format === 'WebP') {
        if (buffer.length < 12) continue
        const webpSignature = buffer.subarray(8, 12).toString('ascii')
        if (webpSignature !== 'WEBP') continue
      }
      
      // Additional check for HEIC/HEIF (needs ftyp + heic/heif brand)
      if (typeInfo.format === 'HEIC/HEIF') {
        if (buffer.length < 12) continue
        if (buffer.length >= 16) {
          const brand = buffer.subarray(8, 12).toString('ascii')
          const compatibleBrand = buffer.subarray(16, 20).toString('ascii')
          if (!['heic', 'heif', 'mif1'].includes(brand.toLowerCase()) && 
              !['heic', 'heif', 'mif1'].includes(compatibleBrand.toLowerCase())) {
            continue
          }
        }
      }
      
      return { ...typeInfo }
    }
  }
  
  return null
}

/**
 * Analyze file buffer to determine actual format and detect mismatches
 */
export function analyzeFileBuffer(buffer: Buffer, filename?: string, contentType?: string): FileAnalysis {
  const detectedType = detectFromMagicBytes(buffer) || {
    format: 'Unknown',
    mimeType: 'application/octet-stream',
    confidence: 'low',
    description: 'Unknown file format'
  }
  
  const extension = getFileExtension(filename)
  const expectedFromExtension = extension ? getExpectedFormatFromExtension(extension) : null
  
  const isMismatch = expectedFromExtension && 
    detectedType.format !== 'Unknown' && 
    detectedType.format !== expectedFromExtension.format
  
  const headerHex = getHeaderHex(buffer)
  
  // Extract additional metadata based on format
  const metadata: Record<string, any> = {}
  
  if (detectedType.format === 'JPEG') {
    // Look for EXIF markers
    if (buffer.length > 4) {
      const exifMarker = buffer.subarray(2, 4).toString('hex')
      metadata.hasExif = exifMarker === 'ffe1'
    }
  }
  
  if (detectedType.format === 'HEIC/HEIF') {
    // Extract ftyp box information
    if (buffer.length >= 16) {
      const majorBrand = buffer.subarray(8, 12).toString('ascii')
      const minorVersion = buffer.readUInt32BE(12)
      metadata.ftypMajorBrand = majorBrand
      metadata.ftypMinorVersion = minorVersion
      
      if (buffer.length >= 20) {
        const compatibleBrand = buffer.subarray(16, 20).toString('ascii')
        metadata.ftypCompatibleBrand = compatibleBrand
      }
    }
  }
  
  if (detectedType.format === 'PNG') {
    // PNG chunk information
    if (buffer.length >= 8) {
      const IHDR = buffer.subarray(8, 16).toString('ascii')
      metadata.pngIHDR = IHDR
    }
  }
  
  return {
    detectedType,
    expectedFromExtension: expectedFromExtension?.format || undefined,
    isMismatch,
    bufferSize: buffer.length,
    headerHex,
    metadata
  }
}

/**
 * Check if buffer likely contains HEIC data
 */
export function isLikelyHeicBuffer(buffer: Buffer): boolean {
  const analysis = analyzeFileBuffer(buffer)
  return analysis.detectedType.format === 'HEIC/HEIF' || 
         (analysis.expectedFromExtension && ['heic', 'heif'].includes(analysis.expectedFromExtension.toLowerCase()))
}

/**
 * Get human-readable file analysis summary
 */
export function getFileAnalysisSummary(analysis: FileAnalysis): string {
  const parts = [
    `Detected: ${analysis.detectedType.format}`,
    `Size: ${analysis.bufferSize} bytes`,
    `Header: ${analysis.headerHex}`
  ]
  
  if (analysis.expectedFromExtension) {
    parts.push(`Expected: ${analysis.expectedFromExtension}`)
    if (analysis.isMismatch) {
      parts.push('⚠️ MISMATCH')
    }
  }
  
  return parts.join(' | ')
}
