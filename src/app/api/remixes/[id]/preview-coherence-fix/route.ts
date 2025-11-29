/**
 * API endpoint to preview coherence fixes
 *
 * Generates before/after preview without saving to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { fixCoherence } from '@/lib/coherence-fixing-service'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params

    console.log(`🔍 [PreviewCoherenceFix] Generating preview for draft: ${draftId}`)

    // Fetch the draft with slides, classifications, and product context
    const draft = await prisma.remixPost.findUnique({
      where: { id: draftId },
      select: {
        slides: true,
        slideClassifications: true,
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        },
        project: {
          select: {
            productContext: {
              select: {
                id: true,
                title: true,
                description: true
              }
            }
          }
        }
      }
    })

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Determine which product context to use (draft-level takes priority over project-level)
    const productContext = draft.productContext || draft.project?.productContext || null

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

    if (slides.length === 0) {
      return NextResponse.json(
        { error: 'No slides to fix' },
        { status: 400 }
      )
    }

    // Validate slide count
    if (slides.length > 50) {
      return NextResponse.json(
        { error: 'Draft too large. Maximum 50 slides supported.' },
        { status: 400 }
      )
    }

    // Fix coherence with product context
    const classifications = (draft.slideClassifications as any) || []
    const result = await fixCoherence(
      slides,
      classifications,
      productContext
    )

    // Helper to get slide type
    const getSlideType = (index: number) =>
      Array.isArray(classifications) ? classifications.find((c: any) => c.slideIndex === index)?.type : undefined

    // Create a map of fixed slides for quick lookup
    const fixedSlidesMap = new Map(
      result.slides.map(fixed => [fixed.slideIndex, fixed])
    )

    // Build all slides with before/after info (including unchanged ones)
    const allSlides = slides.map((slide: any, index: number) => {
      const fixed = fixedSlidesMap.get(index)
      const slideType = getSlideType(index) || 'CONTENT'
      const beforeText = slide.paraphrasedText || ''

      if (fixed) {
        console.log(`[PreviewCoherenceFix] Slide ${index} (${slideType}): "${beforeText.substring(0, 50)}..." -> "${fixed.fixedText.substring(0, 50)}..."`)
        return {
          slideIndex: index,
          slideType,
          before: beforeText,
          after: fixed.fixedText,
          changes: fixed.changes,
          hasChanges: true
        }
      } else {
        return {
          slideIndex: index,
          slideType,
          before: beforeText,
          after: beforeText, // Same as before - no changes
          changes: 'No changes needed',
          hasChanges: false
        }
      }
    })

    // Also keep the old beforeAfter for backward compatibility (only changed slides)
    const beforeAfter = result.slides
      .filter(fixed => slides[fixed.slideIndex])
      .map(fixed => ({
        slideIndex: fixed.slideIndex,
        before: slides[fixed.slideIndex].paraphrasedText || '',
        after: fixed.fixedText,
        changes: fixed.changes
      }))

    console.log(`✅ [PreviewCoherenceFix] Generated preview for ${result.slides.length} slides (${slides.length} total)`)

    // Return preview without saving to DB
    return NextResponse.json({
      success: true,
      beforeAfter,
      allSlides, // New: all slides with their status
      summary: result.summary
    })

  } catch (error) {
    console.error('[PreviewCoherenceFix] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
