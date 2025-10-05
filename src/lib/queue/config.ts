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
  lazyConnect: true,
}

// Create a single shared Redis connection for BullMQ
let sharedRedisConnection: Redis | null = null

export const createRedisConnection = () => {
  if (sharedRedisConnection) {
    return sharedRedisConnection
  }

  sharedRedisConnection = new Redis(redisUrl, redisConfig)

  // Ensure maxRetriesPerRequest is set correctly for BullMQ
  if (sharedRedisConnection.options.maxRetriesPerRequest !== null) {
    sharedRedisConnection.options.maxRetriesPerRequest = null
  }

  return sharedRedisConnection
}

// Queue names
export const QUEUE_NAMES = {
  MEDIA_CACHE: 'media-cache',
} as const

// Default queue options
export const defaultQueueOptions: QueueOptions = {
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
}

// Default worker options
export const defaultWorkerOptions: WorkerOptions = {
  connection: new Redis(redisUrl, redisConfig),
  concurrency: 5, // Process up to 5 jobs concurrently
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
}

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