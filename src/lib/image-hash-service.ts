/**
 * Image Hashing Service
 *
 * Provides perceptual image hashing for deduplication.
 * Uses average hash (aHash) algorithm which is fast and effective for detecting duplicates.
 */

import sharp from 'sharp'
import { cacheAssetService } from './cache-asset-service'

/**
 * Compute perceptual hash (average hash) of an image buffer
 *
 * Algorithm:
 * 1. Resize image to 8x8 pixels
 * 2. Convert to grayscale
 * 3. Calculate average pixel value
 * 4. Create binary hash: 1 if pixel > average, 0 otherwise
 * 5. Convert to hexadecimal string
 *
 * @param buffer - Image buffer to hash
 * @returns Hexadecimal hash string (16 characters)
 */
export async function computeImageHash(buffer: Buffer): Promise<string> {
  try {
    // Resize to 8x8 and convert to grayscale
    const resized = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer()

    // Calculate average pixel value
    let sum = 0
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i]
    }
    const average = sum / resized.length

    // Create binary hash
    let hash = BigInt(0)
    for (let i = 0; i < resized.length; i++) {
      hash = hash << BigInt(1)
      if (resized[i] > average) {
        hash = hash | BigInt(1)
      }
    }

    // Convert to hexadecimal string (16 characters for 64 bits)
    return hash.toString(16).padStart(16, '0')
  } catch (error) {
    console.error('Failed to compute image hash:', error)
    throw new Error(`Failed to compute image hash: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Compute perceptual hash from a cache asset ID
 *
 * @param cacheAssetId - Cache asset ID to hash
 * @returns Hexadecimal hash string (16 characters)
 */
export async function computeImageHashFromCacheAsset(cacheAssetId: string): Promise<string> {
  try {
    // Get the image URL from cache asset
    const url = await cacheAssetService.getUrl(cacheAssetId)
    if (!url) {
      throw new Error(`Could not resolve URL for cache asset: ${cacheAssetId}`)
    }

    // Download the image
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Compute hash
    return await computeImageHash(buffer)
  } catch (error) {
    console.error(`Failed to compute hash for cache asset ${cacheAssetId}:`, error)
    throw error
  }
}

/**
 * Calculate Hamming distance between two hashes
 * Returns the number of differing bits
 *
 * @param hash1 - First hash (hex string)
 * @param hash2 - Second hash (hex string)
 * @returns Number of differing bits (0 = identical, 64 = completely different)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length')
  }

  const bigInt1 = BigInt('0x' + hash1)
  const bigInt2 = BigInt('0x' + hash2)
  const xor = bigInt1 ^ bigInt2

  // Count number of 1 bits in XOR result
  let count = 0
  let n = xor
  while (n > BigInt(0)) {
    count += Number(n & BigInt(1))
    n = n >> BigInt(1)
  }

  return count
}

/**
 * Check if two hashes are similar within a threshold
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @param threshold - Maximum Hamming distance to consider similar (default: 5)
 * @returns true if hashes are similar
 */
export function areSimilarImages(hash1: string, hash2: string, threshold = 5): boolean {
  const distance = hammingDistance(hash1, hash2)
  return distance <= threshold
}
