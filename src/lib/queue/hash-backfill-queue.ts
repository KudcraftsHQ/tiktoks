/**
 * Hash Backfill Queue
 *
 * Manages the queue for background image hash computation for existing assets
 */

import { Queue } from 'bullmq'
import { QUEUE_NAMES, getDefaultQueueOptions, HashBackfillJobData, isBuildTime } from './config'

class HashBackfillQueue {
  private queue: Queue<HashBackfillJobData> | null = null

  constructor() {
    // Skip queue creation during build
    if (isBuildTime) {
      console.log('⏭️ [HashBackfillQueue] Skipping queue creation during build')
      return
    }
    this.queue = new Queue(QUEUE_NAMES.HASH_BACKFILL, getDefaultQueueOptions())
  }

  /**
   * Add a hash backfill job to the queue
   */
  async addHashBackfillJob(data: HashBackfillJobData, priority = 0): Promise<void> {
    if (!this.queue) {
      console.warn('⚠️ [HashBackfillQueue] Queue not initialized, skipping job')
      return
    }

    console.log(`📋 [HashBackfillQueue] Adding hash backfill job for asset: ${data.assetId}`)

    await this.queue.add(
      'backfill-hash',
      data,
      {
        priority, // Higher priority = processed first
        jobId: `hash-backfill-${data.assetId}`, // Use asset ID as unique job ID
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    )

    console.log(`✅ [HashBackfillQueue] Hash backfill job added successfully`)
  }

  /**
   * Add multiple hash backfill jobs to the queue
   */
  async addBulkHashBackfillJobs(jobs: HashBackfillJobData[], priority = 0): Promise<void> {
    if (!this.queue) {
      console.warn('⚠️ [HashBackfillQueue] Queue not initialized, skipping bulk jobs')
      return
    }

    console.log(`📋 [HashBackfillQueue] Adding ${jobs.length} bulk hash backfill jobs`)

    const bulkJobs = jobs.map((data) => ({
      name: 'backfill-hash',
      data,
      opts: {
        priority,
        jobId: `hash-backfill-${data.assetId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }))

    await this.queue.addBulk(bulkJobs)
    console.log(`✅ [HashBackfillQueue] ${jobs.length} bulk hash backfill jobs added successfully`)
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
    console.log(`🗑️ [HashBackfillQueue] Queue cleared`)
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue<HashBackfillJobData> | null {
    return this.queue
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    if (!this.queue) return
    await this.queue.close()
    console.log(`🔌 [HashBackfillQueue] Queue connection closed`)
  }
}

// Export singleton instance
export const hashBackfillQueue = new HashBackfillQueue()
export default HashBackfillQueue
