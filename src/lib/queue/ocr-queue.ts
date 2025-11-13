/**
 * OCR Queue
 *
 * Manages the queue for background OCR processing operations
 */

import { Queue } from 'bullmq'
import { QUEUE_NAMES, getDefaultQueueOptions, OCRJobData } from './config'

class OCRQueue {
  private queue: Queue<OCRJobData>

  constructor() {
    this.queue = new Queue(QUEUE_NAMES.OCR, getDefaultQueueOptions())
  }

  /**
   * Add an OCR job to the queue for a single post
   */
  async addOCRJob(postId: string, priority = 0): Promise<void> {
    console.log(`📋 [OCRQueue] Adding OCR job for post: ${postId}`)

    await this.queue.add(
      'process-ocr',
      { postId },
      {
        priority, // Higher priority = processed first
        jobId: `ocr-${postId}`, // Use post ID as unique job ID to prevent duplicates
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    )

    console.log(`✅ [OCRQueue] OCR job added successfully for post: ${postId}`)
  }

  /**
   * Add multiple OCR jobs to the queue
   */
  async addBulkOCRJobs(postIds: string[], priority = 0): Promise<void> {
    console.log(`📋 [OCRQueue] Adding ${postIds.length} bulk OCR jobs`)

    const bulkJobs = postIds.map((postId) => ({
      name: 'process-ocr',
      data: { postId },
      opts: {
        priority,
        jobId: `ocr-${postId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }))

    await this.queue.addBulk(bulkJobs)
    console.log(`✅ [OCRQueue] ${postIds.length} bulk OCR jobs added successfully`)
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
    console.log(`🗑️ [OCRQueue] Queue cleared`)
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue<OCRJobData> {
    return this.queue
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    await this.queue.close()
    console.log(`🔌 [OCRQueue] Queue connection closed`)
  }
}

// Export singleton instance
export const ocrQueue = new OCRQueue()
export default OCRQueue
