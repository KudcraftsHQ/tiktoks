/**
 * Media Cache Queue
 *
 * Manages the queue for background media caching operations
 */

import { Queue } from 'bullmq'
import { QUEUE_NAMES, getDefaultQueueOptions, MediaCacheJobData, isBuildTime } from './config'

class MediaCacheQueue {
  private queue: Queue<MediaCacheJobData> | null = null

  constructor() {
    // Skip queue creation during build
    if (isBuildTime) {
      console.log('⏭️ [MediaCacheQueue] Skipping queue creation during build')
      return
    }
    this.queue = new Queue(QUEUE_NAMES.MEDIA_CACHE, getDefaultQueueOptions())
  }

  /**
   * Add a media caching job to the queue
   */
  async addCacheJob(data: MediaCacheJobData, priority = 0): Promise<void> {
    if (!this.queue) {
      console.warn('⚠️ [MediaCacheQueue] Queue not initialized, skipping job')
      return
    }

    console.log(`📋 [MediaCacheQueue] Adding cache job for URL: ${data.originalUrl}`)
    console.log(`🆔 [MediaCacheQueue] Cache Asset ID: ${data.cacheAssetId}`)

    await this.queue.add(
      'cache-media',
      data,
      {
        priority, // Higher priority = processed first
        jobId: data.cacheAssetId, // Use cache asset ID as unique job ID
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    )

    console.log(`✅ [MediaCacheQueue] Cache job added successfully`)
  }

  /**
   * Add multiple media caching jobs to the queue
   */
  async addBulkCacheJobs(jobs: MediaCacheJobData[], priority = 0): Promise<void> {
    if (!this.queue) {
      console.warn('⚠️ [MediaCacheQueue] Queue not initialized, skipping bulk jobs')
      return
    }

    console.log(`📋 [MediaCacheQueue] Adding ${jobs.length} bulk cache jobs`)

    const bulkJobs = jobs.map((data) => ({
      name: 'cache-media',
      data,
      opts: {
        priority,
        jobId: data.cacheAssetId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }))

    await this.queue.addBulk(bulkJobs)
    console.log(`✅ [MediaCacheQueue] ${jobs.length} bulk cache jobs added successfully`)
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 }
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length,
    }
  }

  /**
   * Clear all jobs in the queue
   */
  async clearQueue(): Promise<void> {
    if (!this.queue) return
    await this.queue.obliterate({ force: true })
    console.log(`🗑️ [MediaCacheQueue] Queue cleared`)
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue<MediaCacheJobData> | null {
    return this.queue
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    if (!this.queue) return
    await this.queue.close()
    console.log(`🔌 [MediaCacheQueue] Queue connection closed`)
  }
}

// Export singleton instance
export const mediaCacheQueue = new MediaCacheQueue()
export default MediaCacheQueue