/**
 * Queue Configuration for BullMQ
 *
 * Configures Redis connection and queue settings for background processing
 */

import { Redis } from 'ioredis'
import { QueueOptions, WorkerOptions } from 'bullmq'

// Redis connection configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

const redisConfig = {
  maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  enableOfflineQueue: true,
}

// Queue names
export const QUEUE_NAMES = {
  MEDIA_CACHE: 'media-cache',
  PROFILE_MONITOR: 'profile-monitor',
} as const

// Get default queue options (creates new connection each time)
export const getDefaultQueueOptions = (): QueueOptions => ({
  connection: new Redis(redisUrl, redisConfig),
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

// Get default worker options (creates new connection each time)
export const getDefaultWorkerOptions = (): WorkerOptions => ({
  connection: new Redis(redisUrl, redisConfig),
  concurrency: 5, // Process up to 5 jobs concurrently
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
})

// Backwards compatibility
export const defaultQueueOptions = getDefaultQueueOptions()
export const defaultWorkerOptions = getDefaultWorkerOptions()

// Job data interfaces
export interface MediaCacheJobData {
  originalUrl: string
  cacheAssetId: string
  folder?: string
  filename?: string
}

// Job result interfaces
export interface MediaCacheJobResult {
  success: boolean
  cacheAssetId: string
  cacheKey?: string
  error?: string
  fileSize?: number
  contentType?: string
}

// Profile Monitoring job interfaces
export interface ProfileMonitorJobData {
  profileId: string
}

export interface ProfileMonitorJobResult {
  success: boolean
  profileId: string
  postsScraped?: number
  pagesScraped?: number
  error?: string
}