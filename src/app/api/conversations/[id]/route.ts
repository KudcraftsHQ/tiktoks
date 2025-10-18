import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@/generated/prisma"

const prisma = new PrismaClient()

/**
 * GET /api/conversations/[id]
 * Fetch a single conversation by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(conversation)
  } catch (error) {
    console.error("Failed to fetch conversation:", error)
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation (e.g., title, selectedPostIds)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, selectedPostIds, currentModel } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (selectedPostIds !== undefined) updateData.selectedPostIds = selectedPostIds
    if (currentModel !== undefined) updateData.currentModel = currentModel

    const conversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(conversation)
  } catch (error) {
    console.error("Failed to update conversation:", error)
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.conversation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete conversation:", error)
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    )
  }
}
