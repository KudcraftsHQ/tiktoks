/**
 * SSE Event Emitter Service
 *
 * Uses Redis Pub/Sub to broadcast events from workers to SSE endpoints
 */

import Redis from 'ioredis'

export interface OCRCompletedEvent {
  type: 'ocr:completed'
  postId: string
  success: boolean
  timestamp: string
}

export type SSEEvent = OCRCompletedEvent

class SSEEventEmitter {
  private publisher: Redis
  private readonly CHANNEL = 'sse:events'

  constructor() {
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
    await this.publisher.quit()
  }
}

// Export singleton instance
export const sseEventEmitter = new SSEEventEmitter()
export default SSEEventEmitter
