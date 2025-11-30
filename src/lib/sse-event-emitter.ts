/**
 * SSE Event Emitter Service
 *
 * Uses Redis Pub/Sub to broadcast events from workers to SSE endpoints
 */

import Redis from 'ioredis'

// Build-time detection - skip Redis connections during Next.js build
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

export interface OCRCompletedEvent {
  type: 'ocr:completed'
  postId: string
  success: boolean
  timestamp: string
}

export type SSEEvent = OCRCompletedEvent

class SSEEventEmitter {
  private publisher: Redis | null = null
  private readonly CHANNEL = 'sse:events'

  constructor() {
    // Skip Redis connection during build
    if (isBuildTime) {
      console.log('⏭️ [SSEEventEmitter] Skipping Redis connection during build')
      return
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    this.publisher = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    })

    this.publisher.on('connect', () => {
      console.log('✅ [SSEEventEmitter] Redis publisher connected')
    })

    this.publisher.on('error', (err) => {
      console.error('❌ [SSEEventEmitter] Redis publisher error:', err)
    })
  }

  /**
   * Emit an OCR completed event
   */
  async emitOCRCompleted(postId: string, success: boolean): Promise<void> {
    // No-op during build
    if (!this.publisher) return

    const event: OCRCompletedEvent = {
      type: 'ocr:completed',
      postId,
      success,
      timestamp: new Date().toISOString()
    }

    try {
      await this.publisher.publish(this.CHANNEL, JSON.stringify(event))
      console.log(`📡 [SSEEventEmitter] Published OCR event for post: ${postId}`)
    } catch (error) {
      console.error('❌ [SSEEventEmitter] Failed to publish event:', error)
    }
  }

  /**
   * Create a subscriber for SSE events
   */
  createSubscriber(): Redis {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    })
  }

  /**
   * Get the channel name for subscribing
   */
  getChannel(): string {
    return this.CHANNEL
  }

  /**
   * Close the publisher connection
   */
  async close(): Promise<void> {
    if (this.publisher) {
      await this.publisher.quit()
    }
  }
}

// Export singleton instance
export const sseEventEmitter = new SSEEventEmitter()
export default SSEEventEmitter
