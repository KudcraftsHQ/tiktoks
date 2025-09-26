/**
 * Cache Asset Client
 *
 * Client-safe service for getting URLs from cache assets.
 * This does NOT import BullMQ or any server-only dependencies.
 */

import { PrismaClient, CacheAsset, CacheStatus } from '@/generated/prisma'
import { generatePresignedUrlFromKey, keyToUrl } from './r2'

class CacheAssetClient {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Get cache asset by ID
   */
  async getCacheAsset(id: string): Promise<CacheAsset | null> {
    return this.prisma.cacheAsset.findUnique({
      where: { id }
    })
  }

  /**
   * Get cache asset by original URL
   */
  async getCacheAssetByUrl(originalUrl: string): Promise<CacheAsset | null> {
    return this.prisma.cacheAsset.findUnique({
      where: { originalUrl }
    })
  }

  /**
   * Get the best available URL for a cache asset or original URL
   * This is the main method that client components should use
   */
  async getUrl(cacheAssetIdOrKey: string | null | undefined, originalUrl?: string): Promise<string> {
    console.log(`🔗 [CacheAssetClient] Getting URL for cache asset/key: ${cacheAssetIdOrKey}`)

    if (!cacheAssetIdOrKey) {
      console.log(`⚠️ [CacheAssetClient] No cache asset ID/key, using original URL: ${originalUrl}`)
      return originalUrl || ''
    }

    try {
      // First try to find it as a cache asset ID
      const cacheAsset = await this.prisma.cacheAsset.findUnique({
        where: { id: cacheAssetIdOrKey }
      })

      if (cacheAsset) {
        // If cached successfully, return presigned URL
        if (cacheAsset.status === CacheStatus.CACHED && cacheAsset.cacheKey) {
          console.log(`✅ [CacheAssetClient] Cache asset is cached, generating presigned URL`)
          try {
            const presignedUrl = await generatePresignedUrlFromKey(cacheAsset.cacheKey)
            console.log(`✅ [CacheAssetClient] Generated presigned URL`)
            return presignedUrl
          } catch (error) {
            console.warn(`❌ [CacheAssetClient] Failed to generate presigned URL, using public URL:`, error)
            try {
              const publicUrl = keyToUrl(cacheAsset.cacheKey)
              console.log(`🔄 [CacheAssetClient] Using public URL as fallback`)
              return publicUrl
            } catch (fallbackError) {
              console.warn(`❌ [CacheAssetClient] Failed to generate public URL:`, fallbackError)
            }
          }
        }

        // Fall back to original URL from cache asset
        const fallbackUrl = originalUrl || cacheAsset.originalUrl
        console.log(`🔄 [CacheAssetClient] Using original URL: ${fallbackUrl}`)
        return fallbackUrl
      }

      // If not found as cache asset ID, treat as legacy R2 key
      console.log(`🔄 [CacheAssetClient] Not found as cache asset ID, treating as legacy R2 key`)
      try {
        const presignedUrl = await generatePresignedUrlFromKey(cacheAssetIdOrKey)
        console.log(`✅ [CacheAssetClient] Generated presigned URL from legacy key`)
        return presignedUrl
      } catch (error) {
        console.warn(`❌ [CacheAssetClient] Failed to generate presigned URL from legacy key:`, error)
        try {
          const publicUrl = keyToUrl(cacheAssetIdOrKey)
          console.log(`🔄 [CacheAssetClient] Using public URL from legacy key`)
          return publicUrl
        } catch (fallbackError) {
          console.warn(`❌ [CacheAssetClient] Failed to generate public URL from legacy key:`, fallbackError)
        }
      }

      // Final fallback to original URL
      console.log(`🔄 [CacheAssetClient] Final fallback to original URL: ${originalUrl}`)
      return originalUrl || ''

    } catch (error) {
      console.error(`❌ [CacheAssetClient] Error getting URL:`, error)
      return originalUrl || ''
    }
  }

  /**
   * Get multiple URLs from cache asset IDs or keys
   */
  async getUrls(
    cacheAssetIdsOrKeys: (string | null | undefined)[],
    originalUrls?: (string | undefined)[]
  ): Promise<string[]> {
    console.log(`🔗 [CacheAssetClient] Getting URLs for ${cacheAssetIdsOrKeys.length} cache assets/keys`)

    const urls = await Promise.all(
      cacheAssetIdsOrKeys.map(async (cacheAssetIdOrKey, index) => {
        const originalUrl = originalUrls?.[index]
        return this.getUrl(cacheAssetIdOrKey, originalUrl)
      })
    )

    console.log(`🎯 [CacheAssetClient] Resolved ${urls.length} URLs`)
    return urls
  }
}

// Export singleton instance
export const cacheAssetClient = new CacheAssetClient()
export default CacheAssetClient