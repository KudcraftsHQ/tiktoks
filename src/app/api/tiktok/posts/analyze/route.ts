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

    // Estimate user prompt tokens (rough approximation: ~4 chars per token)
    const estimatedUserPromptTokens = Math.ceil(prompt.length / 4)

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
          const totalInputTokens = (usage as any)?.promptTokens || (usage as any)?.input_tokens || 0
          const outputTokens = (usage as any)?.completionTokens || (usage as any)?.output_tokens || 0

          // Calculate context tokens (everything except the user's current prompt)
          // This includes previous messages, OCR data, and system prompt
          const contextTokens = Math.max(0, totalInputTokens - estimatedUserPromptTokens)

          // Calculate costs for each part
          const contextCost = calculateCost(model, contextTokens, 0)
          const responseCost = calculateCost(model, 0, outputTokens)
          const totalCost = contextCost + responseCost

          // Send usage information (total tokens consumed in this API call)
          const usageData = JSON.stringify({
            type: "usage",
            inputTokens: totalInputTokens,
            outputTokens,
            cost: totalCost,
          })
          controller.enqueue(encoder.encode(`data: ${usageData}\n\n`))

          // Save or update conversation
          const title =
            existingConversation?.title ||
            prompt.substring(0, 50).trim() + "..."

          // User message contains the context (previous messages + OCR data + system prompt)
          const userMessage: Message = {
            role: "user",
            content: prompt,
            model,
            inputTokens: contextTokens,
            outputTokens: 0,
            cost: contextCost,
            timestamp: new Date().toISOString(),
          }

          // Assistant message contains only the response tokens and cost
          const assistantMessage: Message = {
            role: "assistant",
            content: streamedText,
            thinking: thinkingContent || undefined,
            model,
            inputTokens: 0, // Assistant doesn't consume input tokens, only outputs
            outputTokens,
            cost: responseCost,
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
                role: userMessage.role,
                content: userMessage.content,
                model: userMessage.model,
                inputTokens: userMessage.inputTokens,
                outputTokens: userMessage.outputTokens,
                cost: userMessage.cost,
                timestamp: userMessage.timestamp,
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
            // Only add the cost from THIS API call (context + response)
            // Don't re-add previous message costs since they're already in totalCost
            const newTotalInputTokens =
              existingConversation.totalInputTokens + contextTokens
            const newTotalOutputTokens =
              existingConversation.totalOutputTokens + outputTokens
            const newTotalCost =
              (existingConversation.totalCost || 0) + totalCost

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
                role: userMessage.role,
                content: userMessage.content,
                model: userMessage.model,
                inputTokens: userMessage.inputTokens,
                outputTokens: userMessage.outputTokens,
                cost: userMessage.cost,
                timestamp: userMessage.timestamp,
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
                totalInputTokens: contextTokens,
                totalOutputTokens: outputTokens,
                totalCost: totalCost,
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
            `✅ [Analysis] Completed analysis (${contextTokens} context, ${outputTokens} output tokens, ${formatCost(totalCost)})`
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
