import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const remixId = resolvedParams.id

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    // Get current bookmark status
    const currentRemix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      select: { bookmarked: true }
    })

    if (!currentRemix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Toggle bookmark status
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        bookmarked: !currentRemix.bookmarked
      },
      select: {
        id: true,
        bookmarked: true
      }
    })

    console.log(`🔖 [API] Toggled bookmark for remix ${remixId}: ${updatedRemix.bookmarked}`)

    return NextResponse.json({
      success: true,
      bookmarked: updatedRemix.bookmarked
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to toggle bookmark for remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to toggle bookmark',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
