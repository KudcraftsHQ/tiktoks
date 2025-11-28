/**
 * API endpoint to auto-fill empty slides with random concept examples
 *
 * For each empty CONTENT slide, picks a random CONTENT concept and example.
 * For the last slide (if empty), picks a random CTA concept and example.
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

interface AutoFillResult {
  slideIndex: number
  text: string
  conceptId: string
  conceptTitle: string
  exampleId: string
  exampleIds: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params

    console.log(`🎯 [AutoFill] Starting auto-fill for draft: ${draftId}`)

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

    const classifications = (draft.slideClassifications as any) || []

    console.log('[AutoFill] Draft slideClassifications:', JSON.stringify(classifications, null, 2))

    // Helper to get slide type (normalized to uppercase for consistency)
    const getSlideType = (index: number) => {
      if (!Array.isArray(classifications)) {
        console.log(`[AutoFill] Classifications is not an array:`, typeof classifications)
        return undefined
      }
      const classification = classifications.find((c: any) => c.slideIndex === index)
      console.log(`[AutoFill] Slide ${index} classification:`, classification)
      // Normalize to uppercase to handle both old lowercase and new uppercase formats
      return classification?.type?.toUpperCase()
    }

    // Check if slide is empty (no text or very short text)
    const isSlideEmpty = (slide: any) => {
      const text = slide.paraphrasedText || ''
      return text.trim().length < 10
    }

    // Fetch all concepts grouped by type
    const [hookConcepts, contentConcepts, ctaConcepts] = await Promise.all([
      prisma.conceptBank.findMany({
        where: { type: 'HOOK' },
        include: {
          examples: {
            select: { id: true, text: true }
          }
        }
      }),
      prisma.conceptBank.findMany({
        where: { type: 'CONTENT' },
        include: {
          examples: {
            select: { id: true, text: true }
          }
        }
      }),
      prisma.conceptBank.findMany({
        where: { type: 'CTA' },
        include: {
          examples: {
            select: { id: true, text: true }
          }
        }
      })
    ])

    // Filter to concepts with examples
    const hookConceptsWithExamples = hookConcepts.filter(c => c.examples.length > 0)
    const contentConceptsWithExamples = contentConcepts.filter(c => c.examples.length > 0)
    const ctaConceptsWithExamples = ctaConcepts.filter(c => c.examples.length > 0)

    if (contentConceptsWithExamples.length === 0 && ctaConceptsWithExamples.length === 0 && hookConceptsWithExamples.length === 0) {
      return NextResponse.json(
        { error: 'No concepts with examples found' },
        { status: 400 }
      )
    }

    // Pick random element from array
    const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

    const results: AutoFillResult[] = []
    const updatedSlides = [...slides]
    const updatedClassifications = [...(Array.isArray(classifications) ? classifications : [])]

    // Process slides starting from index 1 (skip HOOK at index 0)
    for (let i = 1; i < slides.length; i++) {
      const slide = slides[i]

      // Only fill empty slides
      if (!isSlideEmpty(slide)) {
        continue
      }

      const slideType = getSlideType(i) // Already uppercase
      let conceptsPool: typeof contentConceptsWithExamples
      let selectedType: string

      console.log(`[AutoFill] Slide ${i} type:`, slideType)

      // Match concept type to slide type from classification (slideType is already uppercase)
      if (slideType === 'HOOK' && hookConceptsWithExamples.length > 0) {
        conceptsPool = hookConceptsWithExamples
        selectedType = 'HOOK'
      } else if (slideType === 'CTA' && ctaConceptsWithExamples.length > 0) {
        conceptsPool = ctaConceptsWithExamples
        selectedType = 'CTA'
      } else if (slideType === 'CONTENT' && contentConceptsWithExamples.length > 0) {
        conceptsPool = contentConceptsWithExamples
        selectedType = 'CONTENT'
      } else {
        // Fallback: Last slide gets CTA, others get CONTENT
        if (i === slides.length - 1 && ctaConceptsWithExamples.length > 0) {
          conceptsPool = ctaConceptsWithExamples
          selectedType = 'CTA (fallback)'
        } else if (contentConceptsWithExamples.length > 0) {
          conceptsPool = contentConceptsWithExamples
          selectedType = 'CONTENT (fallback)'
        } else {
          console.log(`[AutoFill] No concepts available for slide ${i}`)
          continue
        }
      }

      console.log(`[AutoFill] Slide ${i} using ${selectedType} concepts pool with ${conceptsPool.length} concepts`)

      if (conceptsPool.length === 0) {
        console.log(`[AutoFill] No concepts available for slide ${i} type ${slideType}`)
        continue
      }

      // Pick random concept and example
      const concept = pickRandom(conceptsPool)
      const example = pickRandom(concept.examples)

      // Split text by newlines to create textBoxes
      const textLines = example.text.split('\n').filter(line => line.trim() !== '')
      const updatedTextBoxes = textLines.map((line, index) => {
        const existingTextBox = slide.textBoxes?.[index]

        if (existingTextBox) {
          return { ...existingTextBox, text: line }
        } else {
          return {
            id: `text_${Date.now()}_${i}_${index}`,
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

      // Update slide
      updatedSlides[i] = {
        ...slide,
        paraphrasedText: example.text,
        textBoxes: updatedTextBoxes
      }

      // Update classification with concept info
      const classificationIndex = updatedClassifications.findIndex(
        (c: any) => c.slideIndex === i
      )
      if (classificationIndex !== -1) {
        updatedClassifications[classificationIndex] = {
          ...updatedClassifications[classificationIndex],
          conceptId: concept.id,
          conceptTitle: concept.title
        }
      }

      results.push({
        slideIndex: i,
        text: example.text,
        conceptId: concept.id,
        conceptTitle: concept.title,
        exampleId: example.id,
        exampleIds: concept.examples.map(e => e.id)
      })
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No empty slides to fill',
        filledCount: 0,
        results: []
      })
    }

    // Update draft in database
    await prisma.$transaction(async (tx) => {
      // Update draft with new slides and classifications
      await tx.remixPost.update({
        where: { id: draftId },
        data: {
          slides: JSON.stringify(updatedSlides),
          slideClassifications: updatedClassifications,
          updatedAt: new Date()
        }
      })

      // Increment concept usage counters
      for (const result of results) {
        await tx.conceptBank.update({
          where: { id: result.conceptId },
          data: {
            timesUsed: { increment: 1 },
            lastUsedAt: new Date()
          }
        })
      }
    })

    console.log(`✅ [AutoFill] Filled ${results.length} slides`)

    return NextResponse.json({
      success: true,
      filledCount: results.length,
      results
    })

  } catch (error) {
    console.error('[AutoFill] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
