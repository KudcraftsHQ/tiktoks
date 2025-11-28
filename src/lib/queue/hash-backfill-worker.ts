/**
 * Hash Backfill Worker
 *
 * Processes hash backfill jobs to compute image hashes for existing assets
 */

import { Worker, Job } from 'bullmq'
import { PrismaClient } from '@/generated/prisma'
import {
  QUEUE_NAMES,
  defaultWorkerOptions,
  HashBackfillJobData,
  HashBackfillJobResult,
} from './config'
import { computeImageHashFromCacheAsset } from '@/lib/image-hash-service'
import * as Sentry from '@sentry/node'

const prisma = new PrismaClient()

/**
 * Process a hash backfill job
 */
async function processHashBackfillJob(
  job: Job<HashBackfillJobData>
): Promise<HashBackfillJobResult> {
  const { assetId } = job.data

  console.log(`🔍 [HashBackfillWorker] Processing asset: ${assetId}`)

  try {
    // Fetch asset
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        cacheAssetId: true,
        imageHash: true,
        name: true,
      }
    })

    if (!asset) {
      console.warn(`⚠️ [HashBackfillWorker] Asset not found: ${assetId}`)
      return {
        success: false,
        assetId,
        error: 'Asset not found',
      }
    }

    // Skip if hash already exists
    if (asset.imageHash) {
      console.log(`⏭️ [HashBackfillWorker] Asset already has hash: ${assetId}`)
      return {
        success: true,
        assetId,
        imageHash: asset.imageHash,
      }
    }

    // Compute hash from cache asset
    console.log(`🔑 [HashBackfillWorker] Computing hash for asset: ${asset.name}`)
    const imageHash = await computeImageHashFromCacheAsset(asset.cacheAssetId)

    // Update asset with computed hash
    await prisma.asset.update({
      where: { id: assetId },
      data: { imageHash },
    })

    console.log(`✅ [HashBackfillWorker] Hash computed and saved: ${imageHash}`)

    return {
      success: true,
      assetId,
      imageHash,
    }
  } catch (error) {
    console.error(`❌ [HashBackfillWorker] Failed to process asset ${assetId}:`, error)
    Sentry.captureException(error, {
      tags: {
        worker: 'hash-backfill',
        assetId,
      },
    })

    return {
      success: false,
      assetId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create and start the hash backfill worker
 */
const worker = new Worker<HashBackfillJobData, HashBackfillJobResult>(
  QUEUE_NAMES.HASH_BACKFILL,
  processHashBackfillJob,
  defaultWorkerOptions
)

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✅ [HashBackfillWorker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`❌ [HashBackfillWorker] Job ${job?.id} failed:`, err)
  Sentry.captureException(err, {
    tags: {
      worker: 'hash-backfill',
      jobId: job?.id,
    },
  })
})

worker.on('error', (err) => {
  console.error(`❌ [HashBackfillWorker] Worker error:`, err)
  Sentry.captureException(err, {
    tags: {
      worker: 'hash-backfill',
    },
  })
})

console.log(`✅ [HashBackfillWorker] Worker started and listening for jobs`)

// Export the worker instance
export const hashBackfillWorker = worker
