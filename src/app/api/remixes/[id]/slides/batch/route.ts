import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

interface SlideUpdate {
  slideIndex: number
  backgroundLayers?: Array<{
    type: 'image' | 'color' | 'gradient'
    cacheAssetId?: string
    x?: number
    y?: number
    width?: number
    height?: number
    rotation?: number
    fitMode?: string
    opacity?: number
    blendMode?: string
    zIndex?: number
  }>
  paraphrasedText?: string
  textBoxes?: unknown[]
}

/**
 * PATCH /api/remixes/[id]/slides/batch
 * Batch update multiple slides' backgrounds in a single transaction
 */
export async function PATCH(
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
    const { updates } = body as { updates: SlideUpdate[] }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each update has at least one field
    for (const update of updates) {
      if (typeof update.slideIndex !== 'number' || update.slideIndex < 0) {
        return NextResponse.json(
          { error: 'Each update must have a valid slideIndex >= 0' },
          { status: 400 }
        )
      }
      if (
        update.backgroundLayers === undefined &&
        update.paraphrasedText === undefined &&
        update.textBoxes === undefined
      ) {
        return NextResponse.json(
          {
            error: `Update for slide ${update.slideIndex} must include at least one of: backgroundLayers, paraphrasedText, textBoxes`,
          },
          { status: 400 }
        )
      }
    }

    // Fetch the remix
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
    })

    if (!remix) {
      return NextResponse.json({ error: 'Remix not found' }, { status: 404 })
    }

    // Parse slides
    let slides: unknown[]
    try {
      slides =
        typeof remix.slides === 'string'
          ? JSON.parse(remix.slides)
          : Array.isArray(remix.slides)
            ? remix.slides
            : []
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse slides data' },
        { status: 500 }
      )
    }

    // Validate all slide indices are in range
    const maxIndex = slides.length - 1
    const invalidIndices = updates.filter((u) => u.slideIndex > maxIndex)
    if (invalidIndices.length > 0) {
      return NextResponse.json(
        {
          error: `Slide indices out of range (0-${maxIndex}): ${invalidIndices.map((u) => u.slideIndex).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Apply all updates
    for (const update of updates) {
      const currentSlide = slides[update.slideIndex] as Record<string, unknown>
      slides[update.slideIndex] = {
        ...currentSlide,
        ...(update.backgroundLayers !== undefined && {
          backgroundLayers: update.backgroundLayers,
        }),
        ...(update.paraphrasedText !== undefined && {
          paraphrasedText: update.paraphrasedText,
        }),
        ...(update.textBoxes !== undefined && { textBoxes: update.textBoxes }),
      }
    }

    // Update the remix in database
    console.log(`📝 [BatchSlides] Updating remix ${remixId} with ${updates.length} slide updates`)
    console.log(`📝 [BatchSlides] Slides to save:`, JSON.stringify(slides, null, 2))

    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slides: slides as any, // Json field - Prisma handles serialization
        updatedAt: new Date(),
      },
    })

    console.log(`✅ [BatchSlides] Successfully updated remix ${remixId}`)

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updates.length} slides`,
      updatedCount: updates.length,
      remix: {
        id: updatedRemix.id,
        slides,
      },
    })
  } catch (error) {
    const resolvedParams = await params
    console.error(
      `❌ [API] Failed to batch update slides for remix ${resolvedParams?.id || 'unknown'}:`,
      error
    )

    return NextResponse.json(
      {
        error: 'Failed to batch update slides',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
