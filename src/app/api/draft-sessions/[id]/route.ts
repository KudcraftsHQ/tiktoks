import { NextRequest, NextResponse } from 'next/server'
import { draftSessionService } from '@/lib/draft-session-service'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

const updateSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sessionData = await draftSessionService.getDraftSessionWithData(id)

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Draft session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(sessionData)
  } catch (error) {
    console.error('❌ [API] Failed to fetch draft session:', error)

    Sentry.captureException(error, {
      tags: { operation: 'get_draft_session' },
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch draft session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name } = updateSessionSchema.parse(body)

    const updatedSession = await draftSessionService.updateSessionName(id, name)

    return NextResponse.json(updatedSession)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('❌ [API] Failed to update draft session:', error)

    Sentry.captureException(error, {
      tags: { operation: 'update_draft_session' },
    })

    return NextResponse.json(
      {
        error: 'Failed to update draft session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await draftSessionService.deleteDraftSession(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [API] Failed to delete draft session:', error)

    Sentry.captureException(error, {
      tags: { operation: 'delete_draft_session' },
    })

    return NextResponse.json(
      {
        error: 'Failed to delete draft session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
