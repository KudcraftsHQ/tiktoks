import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { streamText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { PrismaClient } from "@/generated/prisma"
import {
  fetchPostsForAnalysis,
  buildAnalysisContext,
  buildConversationHistory,
} from "@/lib/content-analysis-service"
import { calculateCost, formatCost } from "@/lib/cost-calculation-service"
import { AnalyzeRequest, GeminiModel, Message } from "@/types/conversation"

const prisma = new PrismaClient()

// Create Google AI provider with API key
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
})

/**
 * Map our custom model names to actual Gemini API model IDs
 */
function getGeminiModelId(model: GeminiModel): string {
  const modelMap: Record<GeminiModel, string> = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-thinking": "gemini-2.5-flash-thinking",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-thinking": "gemini-2.5-flash-lite-thinking",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-pro-thinking": "gemini-2.5-pro-thinking",
  }
  return modelMap[model] || model
}

const AnalyzeRequestSchema = z.object({
  conversationId: z.string().nullish(), // Accepts string, null, or undefined
  postIds: z.array(z.string()).min(1).max(20),
  prompt: z.string().min(1),
  model: z.enum([
    "gemini-2.5-flash",
    "gemini-2.5-flash-thinking",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-thinking",
    "gemini-2.5-pro",
    "gemini-2.5-pro-thinking",
  ]) as z.ZodType<GeminiModel>,
})

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)

    const { conversationId, postIds, prompt, model } = validatedData

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      )
    }

    // Fetch posts with OCR data
    const posts = await fetchPostsForAnalysis(postIds)

    if (posts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No posts with completed OCR found. Please run OCR on photo posts first.",
        },
        { status: 400 }
      )
    }

    console.log(
      `🔍 [Analysis] Analyzing ${posts.length} posts with model ${model}`
    )

    // Load existing conversation if provided
    let existingConversation = null
    let previousMessages: Message[] = []

    if (conversationId) {
      try {
        existingConversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        })

        if (existingConversation && existingConversation.messages) {
          previousMessages = (existingConversation.messages as any[]) || []
        }
      } catch (err) {
        console.error("Failed to load conversation:", err)
      }
    }

    // Build context
    const context = await buildAnalysisContext(posts)

    // Build conversation history
    const historyText = buildConversationHistory(
      previousMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
    )

    // Combine everything for the full prompt
    const fullPrompt = historyText + context + prompt

    // Use Vercel AI SDK to stream the response
    const encoder = new TextEncoder()
    let streamedText = ""
    let thinkingContent = ""

    // Create a ReadableStream to send to the client
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // Call Vercel AI SDK's streamText
          const geminiModelId = getGeminiModelId(model)
          const result = await streamText({
            model: google(geminiModelId),
            system: "You are an expert TikTok content analyst. Keep responses concise and focused. Aim for 3-5 key insights rather than exhaustive analysis. Use bullet points when appropriate.",
            messages: [
              {
                role: "user",
                content: fullPrompt,
              },
            ],
          })

          // Stream text chunks
          for await (const chunk of result.fullStream) {
            if (chunk.type === "text-delta") {
              streamedText += chunk.text
              const data = JSON.stringify({ type: "chunk", content: chunk.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          // Extract usage metadata from result
          const usage = await result.usage
          const inputTokens = (usage as any)?.promptTokens || (usage as any)?.input_tokens || 0
          const outputTokens = (usage as any)?.completionTokens || (usage as any)?.output_tokens || 0
          const cost = calculateCost(model, inputTokens, outputTokens)

          // Send usage information
          const usageData = JSON.stringify({
            type: "usage",
            inputTokens,
            outputTokens,
            cost,
          })
          controller.enqueue(encoder.encode(`data: ${usageData}\n\n`))

          // Save or update conversation
          const title =
            existingConversation?.title ||
            prompt.substring(0, 50).trim() + "..."

          const newMessage: Message = {
            role: "user",
            content: prompt,
            model,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            timestamp: new Date().toISOString(),
          }

          const assistantMessage: Message = {
            role: "assistant",
            content: streamedText,
            thinking: thinkingContent || undefined,
            model,
            inputTokens,
            outputTokens,
            cost,
            timestamp: new Date().toISOString(),
          }

          let savedConversation

          if (existingConversation) {
            // Update existing conversation
            const updatedMessages: Record<string, any>[] = [
              ...previousMessages.map(m => ({
                role: m.role,
                content: m.content,
                thinking: m.thinking,
                model: m.model,
                inputTokens: m.inputTokens,
                outputTokens: m.outputTokens,
                cost: m.cost,
                timestamp: m.timestamp,
              })),
              {
                role: newMessage.role,
                content: newMessage.content,
                model: newMessage.model,
                inputTokens: newMessage.inputTokens,
                outputTokens: newMessage.outputTokens,
                cost: newMessage.cost,
                timestamp: newMessage.timestamp,
              },
              {
                role: assistantMessage.role,
                content: assistantMessage.content,
                thinking: assistantMessage.thinking,
                model: assistantMessage.model,
                inputTokens: assistantMessage.inputTokens,
                outputTokens: assistantMessage.outputTokens,
                cost: assistantMessage.cost,
                timestamp: assistantMessage.timestamp,
              },
            ]
            const newTotalInputTokens =
              existingConversation.totalInputTokens + inputTokens
            const newTotalOutputTokens =
              existingConversation.totalOutputTokens + outputTokens
            const newTotalCost =
              (existingConversation.totalCost || 0) + cost

            savedConversation = await prisma.conversation.update({
              where: { id: conversationId },
              data: {
                messages: updatedMessages,
                currentModel: model,
                totalInputTokens: newTotalInputTokens,
                totalOutputTokens: newTotalOutputTokens,
                totalCost: newTotalCost,
                updatedAt: new Date(),
              },
            })
          } else {
            // Create new conversation
            const messagesData: Record<string, any>[] = [
              {
                role: newMessage.role,
                content: newMessage.content,
                model: newMessage.model,
                inputTokens: newMessage.inputTokens,
                outputTokens: newMessage.outputTokens,
                cost: newMessage.cost,
                timestamp: newMessage.timestamp,
              },
              {
                role: assistantMessage.role,
                content: assistantMessage.content,
                thinking: assistantMessage.thinking,
                model: assistantMessage.model,
                inputTokens: assistantMessage.inputTokens,
                outputTokens: assistantMessage.outputTokens,
                cost: assistantMessage.cost,
                timestamp: assistantMessage.timestamp,
              },
            ]
            savedConversation = await prisma.conversation.create({
              data: {
                title,
                selectedPostIds: postIds,
                messages: messagesData,
                currentModel: model,
                totalInputTokens: inputTokens,
                totalOutputTokens: outputTokens,
                totalCost: cost,
              },
            })
          }

          // Send conversation ID
          const convIdData = JSON.stringify({
            type: "conversationId",
            id: savedConversation.id,
          })
          controller.enqueue(encoder.encode(`data: ${convIdData}\n\n`))

          // Send done signal
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()

          console.log(
            `✅ [Analysis] Completed analysis (${inputTokens} input, ${outputTokens} output tokens, ${formatCost(cost)})`
          )
        } catch (error) {
          console.error("❌ [Analysis] Stream error:", error)

          const errorMessage =
            error instanceof Error ? error.message : "Analysis failed"
          const errorData = JSON.stringify({
            type: "chunk",
            content: `\n\n❌ Error: ${errorMessage}`,
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        }
      },
    })

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Failed to analyze posts:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze posts",
      },
      { status: 500 }
    )
  }
}
