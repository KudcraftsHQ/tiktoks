/**
 * Queue Configuration for BullMQ
 *
 * Configures Redis connection and queue settings for background processing
 */

import { Redis } from 'ioredis'
import { QueueOptions, WorkerOptions } from 'bullmq'

// Build-time detection - skip Redis connections during Next.js build
export const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

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
  OCR: 'ocr',
  HASH_BACKFILL: 'hash-backfill',
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

// Backwards compatibility - these create connections at import time
// Only used by worker files which are not imported during Next.js build
export const defaultQueueOptions = isBuildTime ? ({} as QueueOptions) : getDefaultQueueOptions()
export const defaultWorkerOptions = isBuildTime ? ({} as WorkerOptions) : getDefaultWorkerOptions()

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
  forceRecache?: boolean
}

export interface ProfileMonitorJobResult {
  success: boolean
  profileId: string
  postsScraped?: number
  pagesScraped?: number
  error?: string
}

// OCR job interfaces
export interface OCRJobData {
  postId: string
}

export interface OCRJobResult {
  success: boolean
  postId: string
  error?: string
}

// Hash backfill job interfaces
export interface HashBackfillJobData {
  assetId: string
}

export interface HashBackfillJobResult {
  success: boolean
  assetId: string
  imageHash?: string
  error?: string
}