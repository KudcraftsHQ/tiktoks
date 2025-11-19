import { NextRequest } from 'next/server'
import { sseEventEmitter, SSEEvent } from '@/lib/sse-event-emitter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      console.log('📡 [SSE] Client connected to OCR events stream')

      // Create Redis subscriber
      const subscriber = sseEventEmitter.createSubscriber()
      const channel = sseEventEmitter.getChannel()

      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`
      controller.enqueue(encoder.encode(connectMessage))

      // Handle Redis messages
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const event: SSEEvent = JSON.parse(message)
            console.log(`📨 [SSE] Broadcasting event to client:`, event.type)

            // Format as SSE message
            const sseMessage = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(sseMessage))
          } catch (error) {
            console.error('❌ [SSE] Failed to parse event:', error)
          }
        }
      })

      // Subscribe to channel
      subscriber.subscribe(channel, (err) => {
        if (err) {
          console.error('❌ [SSE] Failed to subscribe to channel:', err)
          controller.error(err)
        } else {
          console.log(`✅ [SSE] Subscribed to channel: ${channel}`)
        }
      })

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `:heartbeat\n\n`
          controller.enqueue(encoder.encode(heartbeat))
        } catch (error) {
          console.error('❌ [SSE] Heartbeat failed:', error)
          clearInterval(heartbeatInterval)
        }
      }, 30000)

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('🔌 [SSE] Client disconnected from OCR events stream')
        clearInterval(heartbeatInterval)
        subscriber.unsubscribe(channel)
        subscriber.quit()
        controller.close()
      })
    },
  })

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
