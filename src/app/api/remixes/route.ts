import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema'

const prisma = new PrismaClient()

// Schema for creating a standalone remix without an original post
const CreateStandaloneRemixSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  bookmarked: z.boolean().default(true),
  slideCount: z.number().min(1).max(10).default(5) // Number of empty slides to create
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = CreateStandaloneRemixSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { name, description, bookmarked, slideCount } = validation.data

    console.log(`🎬 [API] Creating standalone remix: ${name}`)

    // Create empty slides
    const slides = Array.from({ length: slideCount }, (_, index) => ({
      id: `slide_${Date.now()}_${index}`,
      displayOrder: index,
      canvas: CANVAS_SIZES.INSTAGRAM_STORY,
      backgroundLayers: createDefaultBackgroundLayers(),
      originalImageIndex: index,
      paraphrasedText: '',
      originalText: '',
      textBoxes: []
    }))

    // Create the remix without an original post
    const createdRemix = await prisma.remixPost.create({
      data: {
        originalPostId: null, // No original post
        productContextId: null,
        name,
        description,
        generationType: 'manual',
        bookmarked,
        slides: JSON.stringify(slides)
      }
    })

    console.log(`✅ [API] Successfully created standalone remix: ${createdRemix.id}`)

    return NextResponse.json({
      success: true,
      message: 'Standalone remix created successfully',
      remix: {
        ...createdRemix,
        slides,
        originalPost: null
      }
    })

  } catch (error) {
    console.error(`❌ [API] Failed to create standalone remix:`, error)

    return NextResponse.json(
      {
        error: 'Failed to create standalone remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
