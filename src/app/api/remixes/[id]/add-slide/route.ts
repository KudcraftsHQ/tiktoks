import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema'

const prisma = new PrismaClient()

export async function POST(
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

    console.log(`➕ [API] Adding slide to remix: ${remixId}`)

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
      console.warn('Failed to parse existing slides, starting fresh:', error)
      existingSlides = []
    }

    // Create new slide with complete structure
    const newSlide = {
      id: `slide_${Date.now()}_${existingSlides.length}`,
      displayOrder: existingSlides.length,
      canvas: CANVAS_SIZES.INSTAGRAM_STORY,
      viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      backgroundLayers: createDefaultBackgroundLayers(),
      originalImageIndex: existingSlides.length,
      paraphrasedText: '',
      originalText: '',
      textBoxes: []
    }

    // Update remix with new slides array
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slides: JSON.stringify([...existingSlides, newSlide]),
        updatedAt: new Date()
      }
    })

    console.log(`✅ [API] Successfully added slide to remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Slide added successfully',
      slide: newSlide,
      totalSlides: existingSlides.length + 1
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to add slide to remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to add slide',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
