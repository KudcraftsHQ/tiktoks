#!/usr/bin/env tsx

/**
 * Background Worker Process
 *
 * Processes background jobs using BullMQ
 *
 * Usage:
 *   pnpm tsx worker.ts
 *
 * Environment Variables:
 *   QUEUE_NAME - Queue to process: 'all', 'media-cache', 'profile-monitor', 'ocr' (default: 'all')
 *   REDIS_HOST - Redis server host (default: localhost)
 *   REDIS_PORT - Redis server port (default: 6379)
 *   REDIS_PASSWORD - Redis password (optional)
 *   REDIS_DB - Redis database number (default: 0)
 */

import { initSentryWorker, flushSentry } from './src/lib/sentry-worker'
import { mediaCacheWorker } from './src/lib/queue/media-cache-worker'
import { profileMonitorWorker } from './src/lib/queue/profile-monitor-worker'
import { ocrWorker } from './src/lib/queue/ocr-worker'
import * as Sentry from '@sentry/node'

// Initialize Sentry for error tracking
initSentryWorker()

const queueName = process.env.QUEUE_NAME || 'all'

console.log('🚀 Starting Background Workers...')
console.log(`📋 Worker Process ID: ${process.pid}`)
console.log(`🎯 Queue Mode: ${queueName}`)
console.log(`🔗 Redis URL: ${process.env.REDIS_URL || 'localhost:6379'}`)
console.log(`⏰ Timestamp: ${new Date().toISOString()}`)
console.log('─'.repeat(60))

const activeWorkers: Array<{ close: () => Promise<void> }> = []

// Start workers based on queue name
if (queueName === 'all' || queueName === 'media-cache') {
  console.log('📦 Starting Media Cache Worker...')
  activeWorkers.push(mediaCacheWorker)
  console.log('✅ Media Cache Worker added to active workers')
}

if (queueName === 'all' || queueName === 'profile-monitor') {
  console.log('👁️ Starting Profile Monitor Worker...')
  activeWorkers.push(profileMonitorWorker)
  console.log('✅ Profile Monitor Worker added to active workers')
}

if (queueName === 'all' || queueName === 'ocr') {
  console.log('🔍 Starting OCR Worker...')
  activeWorkers.push(ocrWorker)
  console.log('✅ OCR Worker added to active workers')
}

if (activeWorkers.length === 0) {
  console.error(`❌ Invalid QUEUE_NAME: ${queueName}. Valid values: 'all', 'media-cache', 'profile-monitor', 'ocr'`)
  process.exit(1)
}

console.log('─'.repeat(60))

// Graceful shutdown handling
const shutdown = async () => {
  console.log('📥 Shutting down gracefully...')
  await Promise.all(activeWorkers.map(worker => worker.close()))
  await flushSentry() // Flush pending Sentry events
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error)
  Sentry.captureException(error)
  await flushSentry()
  await Promise.all(activeWorkers.map(worker => worker.close()))
  process.exit(1)
})

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  Sentry.captureException(reason)
  await flushSentry()
  await Promise.all(activeWorkers.map(worker => worker.close()))
  process.exit(1)
})

console.log(`✅ Workers are running and ready to process jobs (${activeWorkers.length} active)`)
console.log('🛑 Press Ctrl+C to stop the workers')

// Keep the process alive
setInterval(() => {
  // This keeps the process alive while the workers handle jobs
}, 60000) // Check every minute