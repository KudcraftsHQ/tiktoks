import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

const ReorderSlidesSchema = z.object({
  slideIndices: z.array(z.number()).min(1)
})

export async function PUT(
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
    const validation = ReorderSlidesSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { slideIndices } = validation.data

    console.log(`🔄 [API] Reordering slides for remix: ${remixId}`)
    console.log(`🔄 [API] New order: ${slideIndices.join(', ')}`)

    // Get the current remix
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Parse existing slides
    let existingSlides = []
    try {
      existingSlides = typeof remix.slides === 'string'
        ? JSON.parse(remix.slides)
        : remix.slides || []
    } catch (error) {
      console.warn('Failed to parse existing slides:', error)
      return NextResponse.json(
        { error: 'Failed to parse existing slides' },
        { status: 500 }
      )
    }

    // Validate slideIndices
    if (slideIndices.length !== existingSlides.length) {
      return NextResponse.json(
        {
          error: `Invalid slide indices count. Expected ${existingSlides.length}, got ${slideIndices.length}`
        },
        { status: 400 }
      )
    }

    // Validate all indices are present and valid
    const sortedIndices = [...slideIndices].sort((a, b) => a - b)
    const expectedIndices = Array.from({ length: existingSlides.length }, (_, i) => i)
    if (JSON.stringify(sortedIndices) !== JSON.stringify(expectedIndices)) {
      return NextResponse.json(
        { error: 'Invalid slide indices. Must contain all indices from 0 to length-1 exactly once.' },
        { status: 400 }
      )
    }

    console.log(`🔄 [API] Found ${existingSlides.length} slides, reordering...`)

    // Reorder slides based on the provided indices
    const reorderedSlides = slideIndices.map((oldIndex, newIndex) => ({
      ...existingSlides[oldIndex],
      displayOrder: newIndex
    }))

    // Also need to update slideClassifications to reflect the new indices
    let slideClassifications = []
    try {
      slideClassifications = typeof remix.slideClassifications === 'string'
        ? JSON.parse(remix.slideClassifications)
        : (Array.isArray(remix.slideClassifications) ? remix.slideClassifications : [])
    } catch {
      slideClassifications = []
    }

    // Create a mapping from old index to new index
    const indexMapping = new Map<number, number>()
    slideIndices.forEach((oldIndex, newIndex) => {
      indexMapping.set(oldIndex, newIndex)
    })

    // Update classifications with new indices
    const updatedClassifications = slideClassifications.map((classification: any) => ({
      ...classification,
      slideIndex: indexMapping.get(classification.slideIndex) ?? classification.slideIndex
    }))

    // Update remix with new slides array
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slides: JSON.stringify(reorderedSlides),
        slideClassifications: JSON.stringify(updatedClassifications),
        updatedAt: new Date()
      }
    })

    console.log(`✅ [API] Successfully reordered slides for remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Slides reordered successfully',
      totalSlides: reorderedSlides.length,
      newOrder: slideIndices
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to reorder slides for remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to reorder slides',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
