import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@/generated/prisma"

const prisma = new PrismaClient()

/**
 * GET /api/conversations
 * Fetch all conversations ordered by most recent first
 */
export async function GET(request: NextRequest) {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json(conversations)
  } catch (error) {
    console.error("Failed to fetch conversations:", error)
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/conversations
 * Create a new empty conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, selectedPostIds, model } = body

    const conversation = await prisma.conversation.create({
      data: {
        title: title || null,
        selectedPostIds: selectedPostIds || [],
        currentModel: model || "gemini-2.0-flash-thinking-exp-1219",
        messages: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0.0,
      },
    })

    return NextResponse.json(conversation)
  } catch (error) {
    console.error("Failed to create conversation:", error)
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    )
  }
}
