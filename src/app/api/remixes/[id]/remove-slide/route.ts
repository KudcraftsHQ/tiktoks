import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

const RemoveSlideSchema = z.object({
  slideIndex: z.number().min(0)
})

export async function DELETE(
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
    const validation = RemoveSlideSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { slideIndex } = validation.data

    console.log(`🗑️ [API] Removing slide ${slideIndex} from remix: ${remixId}`)

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

    // Validate slide index
    if (slideIndex < 0 || slideIndex >= existingSlides.length) {
      return NextResponse.json(
        { error: `Invalid slide index: ${slideIndex}. Total slides: ${existingSlides.length}` },
        { status: 400 }
      )
    }

    // Don't allow removing the last slide
    if (existingSlides.length === 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last slide. A remix must have at least one slide.' },
        { status: 400 }
      )
    }

    console.log(`🗑️ [API] Found ${existingSlides.length} slides, removing index ${slideIndex}`)

    // Remove the slide
    const updatedSlides = existingSlides.filter((_, index) => index !== slideIndex)

    // Update displayOrder for remaining slides
    const reorderedSlides = updatedSlides.map((slide, index) => ({
      ...slide,
      displayOrder: index
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

    // Remove classification for the deleted slide and update indices
    const updatedClassifications = slideClassifications
      .filter((classification: any) => classification.slideIndex !== slideIndex)
      .map((classification: any) => ({
        ...classification,
        slideIndex: classification.slideIndex > slideIndex
          ? classification.slideIndex - 1
          : classification.slideIndex
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

    console.log(`✅ [API] Successfully removed slide ${slideIndex} from remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Slide removed successfully',
      removedIndex: slideIndex,
      totalSlides: reorderedSlides.length
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to remove slide from remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to remove slide',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
