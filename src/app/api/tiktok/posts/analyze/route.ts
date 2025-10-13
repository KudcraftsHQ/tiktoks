import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import {
  fetchPostsForAnalysis,
  buildAnalysisContext,
  buildConversationHistory
} from '@/lib/content-analysis-service'

const AnalyzeRequestSchema = z.object({
  postIds: z.array(z.string()).min(1).max(20),
  prompt: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)

    const { postIds, prompt, conversationHistory = [] } = validatedData

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Fetch posts with OCR data
    const posts = await fetchPostsForAnalysis(postIds)

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts with completed OCR found. Please run OCR on photo posts first.' },
        { status: 400 }
      )
    }

    console.log(`🔍 [Analysis] Analyzing ${posts.length} posts with prompt: ${prompt.substring(0, 100)}...`)

    // Build context
    const context = await buildAnalysisContext(posts)
    const history = buildConversationHistory(conversationHistory)

    // Combine everything
    const fullPrompt = history + context + prompt

    // Initialize Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await ai.models.generateContentStream({
            model: 'gemini-2.0-flash-lite',
            contents: [
              {
                role: 'user',
                parts: [{ text: fullPrompt }]
              }
            ]
          })

          let totalTokens = 0
          let fullText = ''

          // Stream the response
          for await (const chunk of response) {
            if (chunk.text) {
              fullText += chunk.text
              const data = JSON.stringify({ chunk: chunk.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          // Estimate tokens (roughly 4 characters per token)
          totalTokens = Math.ceil((fullPrompt.length + fullText.length) / 4)
          const tokenData = JSON.stringify({ tokensUsed: totalTokens })
          controller.enqueue(encoder.encode(`data: ${tokenData}\n\n`))

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()

          console.log(`✅ [Analysis] Completed analysis (${totalTokens} tokens)`)
        } catch (error) {
          console.error('❌ [Analysis] Stream error:', error)
          
          const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
          const errorData = JSON.stringify({ 
            chunk: `\n\n❌ Error: ${errorMessage}` 
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Failed to analyze posts:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze posts' },
      { status: 500 }
    )
  }
}
