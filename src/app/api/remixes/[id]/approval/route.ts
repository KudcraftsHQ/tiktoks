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

    const body = await request.json()
    const { approved } = body

    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approved must be a boolean value' },
        { status: 400 }
      )
    }

    // Check if remix exists
    const existingRemix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      select: { id: true, approved: true }
    })

    if (!existingRemix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Update approval status
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: { approved },
      select: {
        id: true,
        approved: true
      }
    })

    console.log(`✅ [API] Updated approval status for remix ${remixId}: ${approved}`)

    return NextResponse.json({
      success: true,
      approved: updatedRemix.approved
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to update approval for remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update approval status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
