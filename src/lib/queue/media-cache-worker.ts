/**
 * Media Cache Worker
 *
 * Background worker that processes media caching jobs
 */

import { Worker, Job, Queue } from 'bullmq'
import { PrismaClient, CacheStatus } from '@/generated/prisma'
import { mediaDownloadService } from '../media-download'
import { uploadToR2 } from '../r2'
import heicConvert from 'heic-convert'
import {
  QUEUE_NAMES,
  defaultWorkerOptions,
  MediaCacheJobData,
  MediaCacheJobResult
} from './config'
import { setJobContext, captureJobError, setupQueueSentryListeners } from '../sentry-worker'

class MediaCacheWorker {
  private worker: Worker<MediaCacheJobData, MediaCacheJobResult>
  private queue: Queue<MediaCacheJobData>
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
    this.queue = new Queue(QUEUE_NAMES.MEDIA_CACHE, defaultWorkerOptions)
    this.worker = new Worker(
      QUEUE_NAMES.MEDIA_CACHE,
      this.processJob.bind(this),
      defaultWorkerOptions
    )

    // Set up event listeners
    this.setupEventListeners()

    // Setup Sentry monitoring for this queue
    setupQueueSentryListeners(this.queue, QUEUE_NAMES.MEDIA_CACHE)
  }

  private setupEventListeners(): void {
    this.worker.on('ready', () => {
      console.log('🚀 [MediaCacheWorker] Worker is ready and waiting for jobs')
    })

    this.worker.on('active', (job) => {
      console.log(`🔄 [MediaCacheWorker] Processing job ${job.id}: ${job.data.originalUrl}`)
    })

    this.worker.on('completed', (job, result) => {
      console.log(`✅ [MediaCacheWorker] Job ${job.id} completed:`, result)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`❌ [MediaCacheWorker] Job ${job?.id} failed:`, err)
      // Capture error in Sentry with job context
      if (job) {
        captureJobError(err, QUEUE_NAMES.MEDIA_CACHE, job.id!, job.data)
      }
    })

    this.worker.on('error', (err) => {
      console.error('❌ [MediaCacheWorker] Worker error:', err)
    })
  }

  private async processJob(
    job: Job<MediaCacheJobData>
  ): Promise<MediaCacheJobResult> {
    const { originalUrl, cacheAssetId, folder = 'media', filename } = job.data

    console.log(`🚀 [MediaCacheWorker] Starting cache job for:`, {
      cacheAssetId,
      originalUrl,
      folder,
      filename
    })

    // Set Sentry context for this job
    setJobContext(QUEUE_NAMES.MEDIA_CACHE, job.id!, job.data)

    try {
      // Update status to DOWNLOADING
      await this.updateCacheAssetStatus(cacheAssetId, CacheStatus.DOWNLOADING)

      // Check if URL is already an R2 URL (don't re-cache)
      if (this.isR2Url(originalUrl)) {
        console.log(`✅ [MediaCacheWorker] URL is already R2 URL, marking as cached: ${originalUrl}`)

        const cacheKey = this.extractKeyFromR2Url(originalUrl)
        await this.updateCacheAssetSuccess(cacheAssetId, cacheKey)

        return {
          success: true,
          cacheAssetId,
          cacheKey,
        }
      }

      // Download the media
      console.log(`⬇️ [MediaCacheWorker] Downloading media from: ${originalUrl}`)
      const downloadResult = await mediaDownloadService.download(originalUrl, {
        timeout: 60000, // 60 seconds for larger files
        retries: 2
      })

      console.log(`📊 [MediaCacheWorker] Download completed:`, {
        filename: downloadResult.filename,
        contentType: downloadResult.contentType,
        size: downloadResult.buffer.length
      })

      // Convert HEIC to JPEG if needed
      let processedBuffer = downloadResult.buffer
      let processedContentType = downloadResult.contentType
      let processedFilename = downloadResult.filename

      if (this.isHeicContent(originalUrl, downloadResult.contentType)) {
        console.log(`🔄 [MediaCacheWorker] Converting HEIC image to JPEG...`)
        try {
          const convertedBuffer = await heicConvert({
            buffer: downloadResult.buffer,
            format: 'JPEG',
            quality: 0.92
          })

          processedBuffer = Buffer.from(convertedBuffer)
          processedContentType = 'image/jpeg'
          processedFilename = this.changeFileExtension(processedFilename || 'image', '.jpg')

          console.log(`✅ [MediaCacheWorker] HEIC conversion completed:`, {
            originalSize: downloadResult.buffer.length,
            convertedSize: processedBuffer.length,
            newFilename: processedFilename
          })
        } catch (conversionError) {
          console.warn(`⚠️ [MediaCacheWorker] HEIC conversion failed, using original:`, conversionError)
          // Continue with original buffer if conversion fails
        }
      }

      // Upload to R2
      console.log(`☁️ [MediaCacheWorker] Uploading to R2...`)
      const uploadResult = await uploadToR2(
        processedBuffer,
        folder,
        filename || processedFilename || `media_${Date.now()}`,
        processedContentType
      )

      console.log(`✅ [MediaCacheWorker] Successfully cached media to R2:`, {
        key: uploadResult.key,
        url: uploadResult.url
      })

      // Update cache asset with success
      await this.updateCacheAssetSuccess(
        cacheAssetId,
        uploadResult.key,
        processedBuffer.length,
        processedContentType
      )

      return {
        success: true,
        cacheAssetId,
        cacheKey: uploadResult.key,
        fileSize: processedBuffer.length,
        contentType: processedContentType,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ [MediaCacheWorker] Failed to cache media ${originalUrl}:`, errorMessage)

      // Update status to FAILED
      await this.updateCacheAssetStatus(cacheAssetId, CacheStatus.FAILED)

      return {
        success: false,
        cacheAssetId,
        error: errorMessage,
      }
    }
  }

  private async updateCacheAssetStatus(
    cacheAssetId: string,
    status: CacheStatus
  ): Promise<void> {
    try {
      await this.prisma.cacheAsset.update({
        where: { id: cacheAssetId },
        data: {
          status,
          updatedAt: new Date()
        }
      })
      console.log(`📝 [MediaCacheWorker] Updated cache asset ${cacheAssetId} status to ${status}`)
    } catch (error) {
      console.error(`❌ [MediaCacheWorker] Failed to update cache asset status:`, error)
    }
  }

  private async updateCacheAssetSuccess(
    cacheAssetId: string,
    cacheKey: string,
    fileSize?: number,
    contentType?: string
  ): Promise<void> {
    try {
      await this.prisma.cacheAsset.update({
        where: { id: cacheAssetId },
        data: {
          status: CacheStatus.CACHED,
          cacheKey,
          fileSize,
          contentType,
          cachedAt: new Date(),
          updatedAt: new Date()
        }
      })
      console.log(`📝 [MediaCacheWorker] Updated cache asset ${cacheAssetId} with success data`)
    } catch (error) {
      console.error(`❌ [MediaCacheWorker] Failed to update cache asset success:`, error)
    }
  }

  private isR2Url(url: string): boolean {
    try {
      const r2Config = {
        publicUrl: process.env.R2_PUBLIC_URL,
        customDomain: process.env.R2_CUSTOM_DOMAIN
      }

      const baseUrl = r2Config.customDomain || r2Config.publicUrl
      return baseUrl ? url.startsWith(baseUrl) : false
    } catch {
      return false
    }
  }

  private extractKeyFromR2Url(url: string): string {
    try {
      const r2Config = {
        publicUrl: process.env.R2_PUBLIC_URL,
        customDomain: process.env.R2_CUSTOM_DOMAIN
      }

      const baseUrl = r2Config.customDomain || r2Config.publicUrl
      if (baseUrl && url.startsWith(baseUrl)) {
        return url.replace(`${baseUrl}/`, '')
      }
      throw new Error('Invalid R2 URL')
    } catch {
      throw new Error('Cannot extract key from R2 URL')
    }
  }

  /**
   * Check if the content is HEIC format based on URL or content type
   */
  private isHeicContent(url: string, contentType?: string): boolean {
    const urlHasHeic = url.toLowerCase().includes('.heic') || url.toLowerCase().includes('.heif')
    const contentTypeIsHeic = contentType?.toLowerCase().includes('heic') || contentType?.toLowerCase().includes('heif')

    return urlHasHeic || contentTypeIsHeic
  }

  /**
   * Change file extension
   */
  private changeFileExtension(filename: string, newExtension: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    if (lastDotIndex === -1) {
      return filename + newExtension
    }
    return filename.substring(0, lastDotIndex) + newExtension
  }

  /**
   * Gracefully close the worker
   */
  async close(): Promise<void> {
    console.log('🛑 [MediaCacheWorker] Closing worker...')
    await this.worker.close()
    await this.queue.close()
    await this.prisma.$disconnect()
    console.log('✅ [MediaCacheWorker] Worker closed successfully')
  }

  /**
   * Get worker instance for monitoring
   */
  getWorker(): Worker<MediaCacheJobData, MediaCacheJobResult> {
    return this.worker
  }
}

// Export singleton instance
export const mediaCacheWorker = new MediaCacheWorker()
export default MediaCacheWorker