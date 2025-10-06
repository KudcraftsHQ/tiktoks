/**
 * Profile Monitor Queue
 *
 * Manages the queue for background profile monitoring operations
 */

import { Queue } from 'bullmq'
import { QUEUE_NAMES, defaultQueueOptions, ProfileMonitorJobData } from './config'

class ProfileMonitorQueue {
  private queue: Queue<ProfileMonitorJobData>

  constructor() {
    console.log('🏗️ [ProfileMonitorQueue] Initializing queue...')
    console.log('📝 [ProfileMonitorQueue] Queue name:', QUEUE_NAMES.PROFILE_MONITOR)
    this.queue = new Queue(QUEUE_NAMES.PROFILE_MONITOR, defaultQueueOptions)
    console.log('✅ [ProfileMonitorQueue] Queue instance created')

    // Debug: Check Redis connection
    if (defaultQueueOptions.connection) {
      const conn = defaultQueueOptions.connection as any
      console.log('🔍 [ProfileMonitorQueue] Redis connection state:', conn.status)
      conn.on('connect', () => console.log('✅ [ProfileMonitorQueue] Redis connected'))
      conn.on('ready', () => console.log('✅ [ProfileMonitorQueue] Redis ready'))
      conn.on('error', (err: Error) => console.error('❌ [ProfileMonitorQueue] Redis error:', err.message))
    }
  }

  /**
   * Add a profile monitoring job to the queue
   */
  async addMonitorJob(profileId: string, priority = 0): Promise<void> {
    console.log(`📋 [ProfileMonitorQueue] Adding monitor job for profile: ${profileId}`)

    // Generate unique job ID with timestamp to allow multiple runs
    const jobId = `monitor-${profileId}-${Date.now()}`
    console.log(`🎯 [ProfileMonitorQueue] Priority: ${priority}, JobId: ${jobId}`)

    const job = await this.queue.add(
      'monitor-profile',
      { profileId },
      {
        priority, // Higher priority = processed first
        jobId, // Unique job ID with timestamp to allow multiple runs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    )

    console.log(`✅ [ProfileMonitorQueue] Monitor job added successfully:`, {
      jobId: job.id,
      name: job.name,
      profileId,
      priority,
      state: await job.getState()
    })

    // Check queue stats
    const stats = await this.getStats()
    console.log(`📊 [ProfileMonitorQueue] Current queue stats:`, stats)
  }

  /**
   * Add multiple profile monitoring jobs to the queue
   */
  async addBulkMonitorJobs(profileIds: string[], priority = 0): Promise<void> {
    console.log(`📋 [ProfileMonitorQueue] Adding ${profileIds.length} bulk monitor jobs`)

    const timestamp = Date.now()
    const bulkJobs = profileIds.map((profileId, index) => ({
      name: 'monitor-profile',
      data: { profileId },
      opts: {
        priority,
        jobId: `monitor-${profileId}-${timestamp}-${index}`, // Unique job ID with timestamp and index
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }))

    await this.queue.addBulk(bulkJobs)
    console.log(`✅ [ProfileMonitorQueue] ${profileIds.length} bulk monitor jobs added successfully`)
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
    console.log(`🗑️ [ProfileMonitorQueue] Queue cleared`)
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue<ProfileMonitorJobData> {
    return this.queue
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    await this.queue.close()
    console.log(`🔌 [ProfileMonitorQueue] Queue connection closed`)
  }
}

// Export singleton instance
export const profileMonitorQueue = new ProfileMonitorQueue()
export default ProfileMonitorQueue
