/**
 * Media Cache Queue
 *
 * Manages the queue for background media caching operations
 */

import { Queue } from 'bullmq'
import { QUEUE_NAMES, defaultQueueOptions, MediaCacheJobData } from './config'

class MediaCacheQueue {
  private queue: Queue<MediaCacheJobData>

  constructor() {
    this.queue = new Queue(QUEUE_NAMES.MEDIA_CACHE, defaultQueueOptions)
  }

  /**
   * Add a media caching job to the queue
   */
  async addCacheJob(data: MediaCacheJobData, priority = 0): Promise<void> {
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
    await this.queue.obliterate({ force: true })
    console.log(`🗑️ [MediaCacheQueue] Queue cleared`)
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue<MediaCacheJobData> {
    return this.queue
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    await this.queue.close()
    console.log(`🔌 [MediaCacheQueue] Queue connection closed`)
  }
}

// Export singleton instance
export const mediaCacheQueue = new MediaCacheQueue()
export default MediaCacheQueue