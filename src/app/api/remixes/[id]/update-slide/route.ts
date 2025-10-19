import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

const UpdateSlideSchema = z.object({
  slideIndex: z.number().min(0),
  field: z.enum(['paraphrasedText', 'originalText']),
  value: z.string()
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
    const validation = UpdateSlideSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { slideIndex, field, value } = validation.data

    console.log(`🔤 [API] Updating slide ${slideIndex} field ${field} for remix: ${remixId}`)
    console.log(`🔤 [API] New value: "${value}"`)

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

    console.log(`🔤 [API] Found ${existingSlides.length} slides`)
    console.log(`🔤 [API] Original slide at index ${slideIndex}:`, existingSlides[slideIndex])

    // Update the specific slide field
    const updatedSlides = [...existingSlides]
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      [field]: value
    }

    console.log(`🔤 [API] Updated slide at index ${slideIndex}:`, updatedSlides[slideIndex])

    // Update remix with new slides array
    const updatedRemix = await prisma.remixPost.update({
      where: { id: remixId },
      data: {
        slides: JSON.stringify(updatedSlides),
        updatedAt: new Date()
      }
    })

    console.log(`✅ [API] Successfully updated slide ${slideIndex} for remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Slide updated successfully',
      slideIndex,
      field,
      value,
      totalSlides: existingSlides.length
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to update slide for remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update slide',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
