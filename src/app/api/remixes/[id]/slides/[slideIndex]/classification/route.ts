import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const UpdateClassificationSchema = z.object({
  slideType: z.enum(['hook', 'content', 'cta'])
})

/**
 * PATCH /api/remixes/[id]/slides/[slideIndex]/classification
 * Update the classification for a specific slide
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slideIndex: string }> }
) {
  try {
    const { id: remixId, slideIndex: slideIndexStr } = await params
    const slideIndex = parseInt(slideIndexStr, 10)

    if (isNaN(slideIndex)) {
      return NextResponse.json(
        { error: 'Invalid slide index' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { slideType } = UpdateClassificationSchema.parse(body)

    // Get the remix
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Parse current slide classifications
    let slideClassifications: Array<{
      slideIndex: number
      type: string
      categoryName: string
    }> = []

    try {
      if (remix.slideClassifications) {
        const parsed = typeof remix.slideClassifications === 'string'
          ? JSON.parse(remix.slideClassifications)
          : remix.slideClassifications
        slideClassifications = Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.error('Failed to parse slide classifications:', error)
      slideClassifications = []
    }

    // Find and update the classification for this slide
    const existingIndex = slideClassifications.findIndex(
      c => c.slideIndex === slideIndex
    )

    if (existingIndex >= 0) {
      // Update existing classification
      slideClassifications[existingIndex] = {
        ...slideClassifications[existingIndex],
        type: slideType.toLowerCase(),
        categoryName: slideClassifications[existingIndex].categoryName || slideType
      }
    } else {
      // Add new classification
      slideClassifications.push({
        slideIndex,
        type: slideType.toLowerCase(),
        categoryName: slideType
      })
    }

    // Sort by slide index
    slideClassifications.sort((a, b) => a.slideIndex - b.slideIndex)

    // Update the remix
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slideClassifications: JSON.stringify(slideClassifications),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      slideClassifications: slideClassifications
    })
  } catch (error) {
    console.error('Failed to update slide classification:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.issues
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to update classification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
