import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema'
import { suggestLayout } from '@/lib/style-presets'

const prisma = new PrismaClient()

// Schema for creating a standalone remix without an original post
const CreateStandaloneRemixSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  bookmarked: z.boolean().default(true),
  slideCount: z.number().min(1).max(10).default(5), // Number of empty slides to create
  projectId: z.string().optional(), // Optional project association
  referenceStructure: z.object({
    slideClassifications: z.array(z.object({
      slideIndex: z.number(),
      slideType: z.string(),
      confidence: z.number().optional()
    }))
  }).optional() // Optional reference structure to copy classifications from
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

    const { name, description, bookmarked, slideCount, projectId, referenceStructure } = validation.data

    console.log(`🎬 [API] Creating standalone remix: ${name}`)
    console.log(`📊 [API] Project ID:`, projectId || 'none')
    console.log(`📊 [API] Reference structure provided:`, !!referenceStructure)
    if (referenceStructure) {
      console.log(`📊 [API] Slide classifications:`, referenceStructure.slideClassifications)
    }

    // Helper to determine slide type based on position (fallback when no reference structure)
    const getSlideType = (index: number, total: number): 'Hook' | 'Content' | 'CTA' => {
      if (index === 0) return 'Hook'
      if (index === total - 1 && total > 2) return 'CTA'
      return 'Content'
    }

    // Normalize slide type to match suggestLayout expectations
    const normalizeSlideType = (type: string): 'Hook' | 'Content' | 'CTA' => {
      const normalized = type.toLowerCase()
      if (normalized === 'hook') return 'Hook'
      if (normalized === 'cta') return 'CTA'
      return 'Content'
    }

    // Get slide type from reference structure or fallback to position-based logic
    const getSlideTypeForIndex = (index: number): 'Hook' | 'Content' | 'CTA' => {
      if (referenceStructure?.slideClassifications) {
        const classification = referenceStructure.slideClassifications.find(
          c => c.slideIndex === index
        )
        if (classification) {
          return normalizeSlideType(classification.slideType)
        }
      }
      return getSlideType(index, slideCount)
    }

    // Create slides with smart layout presets - empty text by default
    const slides = Array.from({ length: slideCount }, (_, index) => {
      const slideType = getSlideTypeForIndex(index)
      const placeholderText = '' // Empty text for all slides

      console.log(`📝 [API] Slide ${index}: type=${slideType}, text="${placeholderText}"`)

      // Generate smart text box with appropriate preset
      const textBox = suggestLayout(placeholderText, slideType, 1080, 1920)

      return {
        id: `slide_${Date.now()}_${index}`,
        displayOrder: index,
        canvas: CANVAS_SIZES.INSTAGRAM_STORY,
        backgroundLayers: createDefaultBackgroundLayers(),
        originalImageIndex: index,
        paraphrasedText: placeholderText,
        originalText: '',
        textBoxes: [textBox]
      }
    })

    // Build slide classifications array from reference structure
    const slideClassifications = referenceStructure?.slideClassifications
      ? referenceStructure.slideClassifications.map(c => ({
          slideIndex: c.slideIndex,
          type: c.slideType.toUpperCase(), // Normalize to uppercase
          categoryName: c.slideType.charAt(0).toUpperCase() + c.slideType.slice(1)
        }))
      : slides.map((_, index) => ({
          slideIndex: index,
          type: getSlideType(index, slideCount).toUpperCase(), // Normalize to uppercase
          categoryName: getSlideType(index, slideCount)
        }))

    // Create the remix without an original post
    const createdRemix = await prisma.remixPost.create({
      data: {
        originalPostId: null, // No original post
        productContextId: null,
        projectId: projectId || null, // Associate with project if provided
        name,
        description,
        generationType: 'manual',
        bookmarked,
        slides: JSON.stringify(slides),
        slideClassifications: slideClassifications // Prisma handles JSON serialization
      }
    })

    console.log(`✅ [API] Successfully created standalone remix: ${createdRemix.id}`)

    return NextResponse.json({
      success: true,
      message: 'Standalone remix created successfully',
      remix: {
        ...createdRemix,
        slides,
        slideClassifications,
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
