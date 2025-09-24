/**
 * Cache Asset Service
 *
 * Service for managing cache assets with background processing using BullMQ
 */

import { v4 as uuidv4 } from 'uuid'
import { PrismaClient, CacheAsset, CacheStatus } from '@/generated/prisma'
import { mediaCacheQueue } from './queue/media-cache-queue'
import { generatePresignedUrlFromKey, keyToUrl } from './r2'

class CacheAssetService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Create a new cache asset and queue it for background processing
   */
  async createCacheAsset(originalUrl: string, folder = 'media', filename?: string): Promise<CacheAsset> {
    console.log(`🚀 [CacheAssetService] Creating cache asset for URL: ${originalUrl}`)

    // Check if cache asset already exists
    const existing = await this.prisma.cacheAsset.findUnique({
      where: { originalUrl }
    })

    if (existing) {
      console.log(`📋 [CacheAssetService] Cache asset already exists: ${existing.id}`)
      return existing
    }

    // Create new cache asset
    const cacheAsset = await this.prisma.cacheAsset.create({
      data: {
        id: uuidv4(),
        originalUrl,
        status: CacheStatus.PENDING,
      }
    })

    console.log(`✅ [CacheAssetService] Created cache asset: ${cacheAsset.id}`)

    // Queue for background processing
    await mediaCacheQueue.addCacheJob({
      originalUrl,
      cacheAssetId: cacheAsset.id,
      folder,
      filename
    })

    return cacheAsset
  }

  /**
   * Create multiple cache assets and queue them for background processing
   */
  async createBulkCacheAssets(
    urls: string[],
    folder = 'media'
  ): Promise<CacheAsset[]> {
    console.log(`🚀 [CacheAssetService] Creating ${urls.length} cache assets`)

    const cacheAssets: CacheAsset[] = []
    const jobsToQueue: Array<{
      originalUrl: string
      cacheAssetId: string
      folder?: string
    }> = []

    for (const url of urls) {
      // Check if cache asset already exists
      let cacheAsset = await this.prisma.cacheAsset.findUnique({
        where: { originalUrl: url }
      })

      if (!cacheAsset) {
        // Create new cache asset
        cacheAsset = await this.prisma.cacheAsset.create({
          data: {
            id: uuidv4(),
            originalUrl: url,
            status: CacheStatus.PENDING,
          }
        })

        // Add to queue jobs
        jobsToQueue.push({
          originalUrl: url,
          cacheAssetId: cacheAsset.id,
          folder
        })
      }

      cacheAssets.push(cacheAsset)
    }

    console.log(`✅ [CacheAssetService] Created ${cacheAssets.length} cache assets`)
    console.log(`📋 [CacheAssetService] Queueing ${jobsToQueue.length} new jobs`)

    // Queue all new jobs
    if (jobsToQueue.length > 0) {
      await mediaCacheQueue.addBulkCacheJobs(jobsToQueue)
    }

    return cacheAssets
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
   * This is the main method that API endpoints should use
   */
  async getUrl(cacheAssetIdOrKey: string | null | undefined, originalUrl?: string): Promise<string> {
    console.log(`🔗 [CacheAssetService] Getting URL for cache asset/key: ${cacheAssetIdOrKey}`)

    if (!cacheAssetIdOrKey) {
      console.log(`⚠️ [CacheAssetService] No cache asset ID/key, using original URL: ${originalUrl}`)
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
          console.log(`✅ [CacheAssetService] Cache asset is cached, generating presigned URL`)
          try {
            const presignedUrl = await generatePresignedUrlFromKey(cacheAsset.cacheKey)
            console.log(`✅ [CacheAssetService] Generated presigned URL`)
            return presignedUrl
          } catch (error) {
            console.warn(`❌ [CacheAssetService] Failed to generate presigned URL, using public URL:`, error)
            try {
              const publicUrl = keyToUrl(cacheAsset.cacheKey)
              console.log(`🔄 [CacheAssetService] Using public URL as fallback`)
              return publicUrl
            } catch (fallbackError) {
              console.warn(`❌ [CacheAssetService] Failed to generate public URL:`, fallbackError)
            }
          }
        }

        // Fall back to original URL from cache asset
        const fallbackUrl = originalUrl || cacheAsset.originalUrl
        console.log(`🔄 [CacheAssetService] Using original URL: ${fallbackUrl}`)
        return fallbackUrl
      }

      // If not found as cache asset ID, treat as legacy R2 key
      console.log(`🔄 [CacheAssetService] Not found as cache asset ID, treating as legacy R2 key`)
      try {
        const presignedUrl = await generatePresignedUrlFromKey(cacheAssetIdOrKey)
        console.log(`✅ [CacheAssetService] Generated presigned URL from legacy key`)
        return presignedUrl
      } catch (error) {
        console.warn(`❌ [CacheAssetService] Failed to generate presigned URL from legacy key:`, error)
        try {
          const publicUrl = keyToUrl(cacheAssetIdOrKey)
          console.log(`🔄 [CacheAssetService] Using public URL from legacy key`)
          return publicUrl
        } catch (fallbackError) {
          console.warn(`❌ [CacheAssetService] Failed to generate public URL from legacy key:`, fallbackError)
        }
      }

      // Final fallback to original URL
      console.log(`🔄 [CacheAssetService] Final fallback to original URL: ${originalUrl}`)
      return originalUrl || ''

    } catch (error) {
      console.error(`❌ [CacheAssetService] Error getting URL:`, error)
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
    console.log(`🔗 [CacheAssetService] Getting URLs for ${cacheAssetIdsOrKeys.length} cache assets/keys`)

    const urls = await Promise.all(
      cacheAssetIdsOrKeys.map(async (cacheAssetIdOrKey, index) => {
        const originalUrl = originalUrls?.[index]
        return this.getUrl(cacheAssetIdOrKey, originalUrl)
      })
    )

    console.log(`🎯 [CacheAssetService] Resolved ${urls.length} URLs`)
    return urls
  }

  /**
   * Get cache asset statistics
   */
  async getStats(): Promise<{
    total: number
    pending: number
    downloading: number
    cached: number
    failed: number
  }> {
    const stats = await this.prisma.cacheAsset.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })

    const result = {
      total: 0,
      pending: 0,
      downloading: 0,
      cached: 0,
      failed: 0
    }

    stats.forEach(stat => {
      result.total += stat._count.id
      switch (stat.status) {
        case CacheStatus.PENDING:
          result.pending = stat._count.id
          break
        case CacheStatus.DOWNLOADING:
          result.downloading = stat._count.id
          break
        case CacheStatus.CACHED:
          result.cached = stat._count.id
          break
        case CacheStatus.FAILED:
          result.failed = stat._count.id
          break
      }
    })

    return result
  }

  /**
   * Retry failed cache assets
   */
  async retryFailed(): Promise<number> {
    console.log(`🔄 [CacheAssetService] Retrying failed cache assets`)

    const failedAssets = await this.prisma.cacheAsset.findMany({
      where: { status: CacheStatus.FAILED }
    })

    console.log(`📋 [CacheAssetService] Found ${failedAssets.length} failed assets to retry`)

    if (failedAssets.length === 0) {
      return 0
    }

    // Reset status to pending
    await this.prisma.cacheAsset.updateMany({
      where: { status: CacheStatus.FAILED },
      data: {
        status: CacheStatus.PENDING,
        updatedAt: new Date()
      }
    })

    // Queue for retry
    const jobs = failedAssets.map(asset => ({
      originalUrl: asset.originalUrl,
      cacheAssetId: asset.id,
      folder: 'media' // Default folder for retries
    }))

    await mediaCacheQueue.addBulkCacheJobs(jobs, 10) // Higher priority for retries

    console.log(`✅ [CacheAssetService] Queued ${failedAssets.length} failed assets for retry`)
    return failedAssets.length
  }

  /**
   * Clean up old cache assets
   */
  async cleanup(olderThanDays = 30): Promise<number> {
    console.log(`🧹 [CacheAssetService] Cleaning up cache assets older than ${olderThanDays} days`)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await this.prisma.cacheAsset.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        status: {
          in: [CacheStatus.FAILED, CacheStatus.CACHED]
        }
      }
    })

    console.log(`🗑️ [CacheAssetService] Deleted ${result.count} old cache assets`)
    return result.count
  }
}

// Export singleton instance
export const cacheAssetService = new CacheAssetService()
export default CacheAssetService