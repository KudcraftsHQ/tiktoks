/**
 * API endpoint to analyze draft coherence
 *
 * Analyzes POV/voice/tone inconsistencies in CONTENT slides
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { analyzeCoherence } from '@/lib/coherence-analysis-service'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params

    console.log(`🔍 [AnalyzeCoherence] Analyzing draft: ${draftId}`)

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
      return NextResponse.json({
        issues: [],
        affectedSlideCount: 0,
        recommendation: 'No slides to analyze.'
      })
    }

    // Analyze coherence with product context
    const analysis = await analyzeCoherence(
      slides,
      (draft.slideClassifications as any) || [],
      productContext
    )

    console.log(`✅ [AnalyzeCoherence] Analysis complete: ${analysis.issues.length} issues found`)

    return NextResponse.json(analysis)

  } catch (error) {
    console.error('[AnalyzeCoherence] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
