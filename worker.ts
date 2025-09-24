#!/usr/bin/env tsx

/**
 * Background Worker Process
 *
 * Processes media caching jobs in the background using BullMQ
 *
 * Usage:
 *   pnpm tsx worker.ts
 *
 * Environment Variables:
 *   REDIS_HOST - Redis server host (default: localhost)
 *   REDIS_PORT - Redis server port (default: 6379)
 *   REDIS_PASSWORD - Redis password (optional)
 *   REDIS_DB - Redis database number (default: 0)
 */

import { mediaCacheWorker } from './src/lib/queue/media-cache-worker'

console.log('🚀 Starting Media Cache Worker...')
console.log(`📋 Worker Process ID: ${process.pid}`)

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('📥 Received SIGTERM, shutting down gracefully...')
  await mediaCacheWorker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('📥 Received SIGINT, shutting down gracefully...')
  await mediaCacheWorker.close()
  process.exit(0)
})

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error)
  await mediaCacheWorker.close()
  process.exit(1)
})

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  await mediaCacheWorker.close()
  process.exit(1)
})

console.log('✅ Media Cache Worker is running and ready to process jobs')
console.log('🛑 Press Ctrl+C to stop the worker')

// Keep the process alive
setInterval(() => {
  // This keeps the process alive while the worker handles jobs
}, 60000) // Check every minute