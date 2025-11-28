/**
 * API endpoint to apply a concept example to a slide
 *
 * Supports two modes:
 * - copy: Directly copy the example text
 * - paraphrase: Use AI to paraphrase with configurable intensity
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { paraphraseSingleExample, ParaphraseIntensity } from '@/lib/minimal-paraphrase-service'

const prisma = new PrismaClient()

// Request body schema
const ApplyExampleSchema = z.object({
  exampleText: z.string().min(1).max(2000),
  mode: z.enum(['copy', 'paraphrase']),
  paraphraseIntensity: z.enum(['minimal', 'medium', 'high']).optional(),
  conceptId: z.string().cuid(),
  exampleId: z.string().cuid()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slideIndex: string }> }
) {
  try {
    const { id: draftId, slideIndex: slideIndexStr } = await params
    const slideIndex = parseInt(slideIndexStr, 10)

    if (isNaN(slideIndex) || slideIndex < 0) {
      return NextResponse.json(
        { error: 'Invalid slide index' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = ApplyExampleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { exampleText, mode, paraphraseIntensity, conceptId, exampleId } = validation.data

    console.log(`📝 [ApplyExample] Draft: ${draftId}, Slide: ${slideIndex}, Mode: ${mode}`)

    // Fetch the draft with slides and classifications
    const draft = await prisma.remixPost.findUnique({
      where: { id: draftId },
      select: {
        slides: true,
        slideClassifications: true
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

    // Validate slide index
    if (slideIndex >= slides.length) {
      return NextResponse.json(
        { error: 'Slide index out of range' },
        { status: 400 }
      )
    }

    // Get slide classification to determine slide type
    const classifications = (draft.slideClassifications as any) || []
    const classification = Array.isArray(classifications)
      ? classifications.find((c: any) => c.slideIndex === slideIndex)
      : undefined
    const slideType = (classification?.type as 'HOOK' | 'CONTENT' | 'CTA') || 'CONTENT'

    // Apply text based on mode
    let finalText: string

    if (mode === 'copy') {
      finalText = exampleText
      console.log(`📋 [ApplyExample] Copying text directly`)
    } else {
      // Paraphrase mode
      const intensity = paraphraseIntensity || 'minimal'
      console.log(`🤖 [ApplyExample] Paraphrasing with intensity: ${intensity}`)

      finalText = await paraphraseSingleExample(
        exampleText,
        slideType,
        intensity as ParaphraseIntensity
      )
    }

    // Update the slide
    const updatedSlide = {
      ...slides[slideIndex],
      paraphrasedText: finalText
    }

    // Split text by newlines to create textBoxes
    const textLines = finalText.split('\n').filter(line => line.trim() !== '')
    const updatedTextBoxes = textLines.map((line, index) => {
      const existingTextBox = updatedSlide.textBoxes?.[index]

      if (existingTextBox) {
        return { ...existingTextBox, text: line }
      } else {
        return {
          id: `text_${Date.now()}_${index}`,
          text: line,
          x: 0.1,
          y: 0.3 + (index * 0.15),
          width: 0.8,
          height: 0.12,
          fontSize: 44,
          fontFamily: 'Poppins',
          fontWeight: 'bold' as const,
          color: '#000000',
          textAlign: 'center' as const,
          backgroundColor: '#ffffff',
          backgroundOpacity: 1,
          borderRadius: 12,
          paddingTop: 24,
          paddingRight: 32,
          paddingBottom: 24,
          paddingLeft: 32,
          lineHeight: 1.2,
          zIndex: index
        }
      }
    })

    updatedSlide.textBoxes = updatedTextBoxes
    slides[slideIndex] = updatedSlide

    // Fetch concept to get title
    const concept = await prisma.conceptBank.findUnique({
      where: { id: conceptId },
      select: { title: true }
    })

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      )
    }

    // Update slide classification with concept info
    const updatedClassifications = Array.isArray(classifications)
      ? classifications.map((c: any) =>
          c.slideIndex === slideIndex
            ? { ...c, conceptId, conceptTitle: concept.title }
            : c
        )
      : []

    // Update draft in database
    await prisma.$transaction([
      // Update draft with new slides and classifications
      prisma.remixPost.update({
        where: { id: draftId },
        data: {
          slides: JSON.stringify(slides),
          slideClassifications: updatedClassifications,
          updatedAt: new Date()
        }
      }),
      // Increment concept usage counter
      prisma.conceptBank.update({
        where: { id: conceptId },
        data: {
          timesUsed: { increment: 1 },
          lastUsedAt: new Date()
        }
      })
    ])

    console.log(`✅ [ApplyExample] Successfully applied example to slide ${slideIndex}`)

    return NextResponse.json({
      success: true,
      paraphrasedText: finalText,
      slideIndex,
      conceptTitle: concept.title
    })

  } catch (error) {
    console.error('[ApplyExample] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
