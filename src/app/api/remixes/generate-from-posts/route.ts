import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateFromMultiplePosts, type GenerationConfig } from '@/lib/multi-post-generation-service'

// Schema with optional config for simple usage
const GenerateFromPostsSchema = z.object({
  postIds: z.array(z.string()).min(2, 'At least 2 posts required').max(20),
  config: z.object({
    name: z.string().min(1),
    variationCount: z.number().min(1).max(50),
    structure: z.object({
      type: z.enum(['fixed', 'dynamic']),
      fixedPattern: z.string().optional(),
      minSlides: z.number().optional(),
      maxSlides: z.number().optional()
    }),
    additionalPrompt: z.string().optional(),
    productContextId: z.string().optional()
  }).optional()
})

/**
 * POST /api/remixes/generate-from-posts
 * Generate remix variations from multiple source posts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = GenerateFromPostsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { postIds, config: userConfig } = validation.data

    // Use sensible defaults if config not provided
    const config: GenerationConfig = userConfig || {
      name: `Multi-Post Remix`,
      variationCount: 1, // Generate just 1 variation for quick generation
      structure: {
        type: 'dynamic',
        minSlides: 5,
        maxSlides: 8
      }
    }

    console.log(`🎨 [API] Generating content from ${postIds.length} posts...`)
    console.log(`  Configuration:`, config)

    // Generate variations
    const generatedRemixes = await generateFromMultiplePosts(
      postIds,
      config
    )

    console.log(`✅ [API] Successfully generated ${generatedRemixes.length} variations`)

    // Return the first remix ID for quick navigation
    const firstRemix = generatedRemixes[0]

    return NextResponse.json({
      success: true,
      message: `Generated ${generatedRemixes.length} variation${generatedRemixes.length > 1 ? 's' : ''}`,
      remixId: firstRemix?.id,
      remixes: generatedRemixes.map(r => ({
        id: r.id,
        name: r.name,
        slideCount: r.slides.length
      }))
    })
  } catch (error) {
    console.error('❌ [API] Generation failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Generation failed'
      },
      { status: 500 }
    )
  }
}
