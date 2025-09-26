/**
 * Queue Configuration for BullMQ
 *
 * Configures Redis connection and queue settings for background processing
 */

import { Redis } from 'ioredis'
import { QueueOptions, WorkerOptions } from 'bullmq'

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
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

  sharedRedisConnection = new Redis(redisConfig)

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
  connection: redisConfig, // Use config object directly
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
  connection: redisConfig, // Use config object directly
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