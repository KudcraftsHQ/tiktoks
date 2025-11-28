/**
 * API endpoint to apply coherence fixes
 *
 * Saves the fixes to database after user confirmation
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const ApplyFixesSchema = z.object({
  fixes: z.array(z.object({
    slideIndex: z.number(),
    fixedText: z.string()
  }))
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params

    console.log(`💾 [ApplyCoherenceFix] Applying fixes to draft: ${draftId}`)

    // Parse and validate request body
    const body = await request.json()
    const validation = ApplyFixesSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { fixes } = validation.data

    // Fetch the draft
    const draft = await prisma.remixPost.findUnique({
      where: { id: draftId },
      select: {
        slides: true
      }
    })

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Parse slides array
    let slides: any[]
    try {
      slides = typeof draft.slides === 'string'
        ? JSON.parse(draft.slides)
        : Array.isArray(draft.slides) ? draft.slides : []
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid slides data' },
        { status: 500 }
      )
    }

    // Apply fixes
    const updatedSlides = slides.map((slide, index) => {
      const fix = fixes.find(f => f.slideIndex === index)
      if (fix) {
        return {
          ...slide,
          paraphrasedText: fix.fixedText
        }
      }
      return slide
    })

    // Update draft in database
    await prisma.remixPost.update({
      where: { id: draftId },
      data: {
        slides: JSON.stringify(updatedSlides),
        updatedAt: new Date()
      }
    })

    console.log(`✅ [ApplyCoherenceFix] Applied ${fixes.length} fixes`)

    return NextResponse.json({
      success: true,
      fixedCount: fixes.length
    })

  } catch (error) {
    console.error('[ApplyCoherenceFix] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
