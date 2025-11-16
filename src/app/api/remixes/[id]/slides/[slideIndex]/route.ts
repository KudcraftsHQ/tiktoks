import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * PATCH /api/remixes/[id]/slides/[slideIndex]
 * Update a specific slide's text content
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slideIndex: string }> }
) {
  try {
    const resolvedParams = await params
    const remixId = resolvedParams.id
    const slideIndex = parseInt(resolvedParams.slideIndex, 10)

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    if (isNaN(slideIndex) || slideIndex < 0) {
      return NextResponse.json(
        { error: 'Valid slide index is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { paraphrasedText } = body

    if (paraphrasedText === undefined) {
      return NextResponse.json(
        { error: 'paraphrasedText is required in request body' },
        { status: 400 }
      )
    }

    // Fetch the remix
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // Parse slides
    let slides: any[]
    try {
      slides = typeof remix.slides === 'string'
        ? JSON.parse(remix.slides)
        : (Array.isArray(remix.slides) ? remix.slides : [])
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse slides data' },
        { status: 500 }
      )
    }

    // Validate slide index
    if (slideIndex >= slides.length) {
      return NextResponse.json(
        { error: `Slide index ${slideIndex} out of range (0-${slides.length - 1})` },
        { status: 400 }
      )
    }

    // Update the slide text
    slides[slideIndex] = {
      ...slides[slideIndex],
      paraphrasedText
    }

    // Update the remix in database
    await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slides: JSON.stringify(slides),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Slide text updated successfully',
      slide: {
        index: slideIndex,
        paraphrasedText
      }
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(
      `❌ [API] Failed to update slide ${resolvedParams?.slideIndex || 'unknown'} for remix ${resolvedParams?.id || 'unknown'}:`,
      error
    )

    return NextResponse.json(
      {
        error: 'Failed to update slide text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
