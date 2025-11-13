/**
 * OCR Worker
 *
 * Background worker that processes OCR jobs for TikTok posts
 */

import { Worker, Job, Queue } from 'bullmq'
import { performOCRForTikTokPost } from '../ocr-service'
import {
  QUEUE_NAMES,
  getDefaultWorkerOptions,
  OCRJobData,
  OCRJobResult
} from './config'
import { setJobContext, captureJobError, setupQueueSentryListeners } from '../sentry-worker'

class OCRWorker {
  private worker: Worker<OCRJobData, OCRJobResult>
  private queue: Queue<OCRJobData>

  constructor() {
    console.log('🏗️ [OCRWorker] Initializing worker...')
    console.log('📝 [OCRWorker] Queue name:', QUEUE_NAMES.OCR)

    const workerOptions = getDefaultWorkerOptions()
    console.log('⚙️ [OCRWorker] Worker options:', {
      concurrency: workerOptions.concurrency,
      redis: process.env.REDIS_URL || 'localhost:6379'
    })

    this.queue = new Queue(QUEUE_NAMES.OCR, workerOptions)
    this.worker = new Worker(
      QUEUE_NAMES.OCR,
      this.processJob.bind(this),
      workerOptions
    )

    console.log('✅ [OCRWorker] Worker instance created')

    // Debug: Check Redis connection
    if (workerOptions.connection) {
      const conn = workerOptions.connection as any
      console.log('🔍 [OCRWorker] Redis connection state:', conn.status)
      conn.on('connect', () => console.log('✅ [OCRWorker] Redis connected'))
      conn.on('ready', () => console.log('✅ [OCRWorker] Redis ready'))
      conn.on('error', (err: Error) => console.error('❌ [OCRWorker] Redis error:', err.message))
      conn.on('close', () => console.log('🔌 [OCRWorker] Redis connection closed'))
    }

    // Set up event listeners
    this.setupEventListeners()

    // Setup Sentry monitoring for this queue
    setupQueueSentryListeners(this.queue, QUEUE_NAMES.OCR)
  }

  private setupEventListeners(): void {
    this.worker.on('ready', () => {
      console.log('🚀 [OCRWorker] Worker is ready and waiting for jobs')
    })

    this.worker.on('active', (job) => {
      console.log(`🔄 [OCRWorker] Processing job ${job.id}: ${job.data.postId}`)
      console.log(`📊 [OCRWorker] Job details:`, {
        id: job.id,
        name: job.name,
        data: job.data,
        priority: job.opts.priority,
        attempts: job.attemptsMade,
        timestamp: new Date().toISOString()
      })
    })

    this.worker.on('completed', (job, result) => {
      console.log(`✅ [OCRWorker] Job ${job.id} completed:`, result)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`❌ [OCRWorker] Job ${job?.id} failed:`, err)
      // Capture error in Sentry with job context
      if (job) {
        captureJobError(err, QUEUE_NAMES.OCR, job.id!, job.data)
      }
    })

    this.worker.on('error', (err) => {
      console.error('❌ [OCRWorker] Worker error:', err)
    })

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️ [OCRWorker] Job ${jobId} stalled`)
    })

    this.worker.on('drained', () => {
      console.log('💤 [OCRWorker] Queue drained, waiting for new jobs...')
    })

    console.log('🎧 [OCRWorker] Event listeners registered')
  }

  private async processJob(
    job: Job<OCRJobData>
  ): Promise<OCRJobResult> {
    const { postId } = job.data

    console.log(`🚀 [OCRWorker] Starting OCR job for post:`, { postId })

    // Set Sentry context for this job
    setJobContext(QUEUE_NAMES.OCR, job.id!, job.data)

    try {
      // Perform OCR processing
      await performOCRForTikTokPost(postId)

      console.log(`✅ [OCRWorker] Successfully processed OCR for post ${postId}`)

      return {
        success: true,
        postId
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      console.error(`❌ [OCRWorker] Failed to process OCR for post ${postId}:`, {
        message: errorMessage,
        errorType: error?.constructor?.name,
        stack: errorStack,
        postId
      })

      return {
        success: false,
        postId,
        error: errorMessage
      }
    }
  }

  /**
   * Gracefully close the worker
   */
  async close(): Promise<void> {
    console.log('🛑 [OCRWorker] Closing worker...')
    await this.worker.close()
    await this.queue.close()
    console.log('✅ [OCRWorker] Worker closed successfully')
  }

  /**
   * Get worker instance for monitoring
   */
  getWorker(): Worker<OCRJobData, OCRJobResult> {
    return this.worker
  }
}

// Export singleton instance
export const ocrWorker = new OCRWorker()
export default OCRWorker
