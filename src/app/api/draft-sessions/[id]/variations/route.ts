import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { generateContent, SourcePost } from '@/lib/content-generation-service'
import { draftSessionService } from '@/lib/draft-session-service'
import * as Sentry from '@sentry/nextjs'

const prisma = new PrismaClient()

const generateVariationsSchema = z.object({
  variationCount: z.number().int().min(1).max(50).default(5),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const body = await request.json()
    const { variationCount } = generateVariationsSchema.parse(body)

    console.log(`📝 [API] Generating ${variationCount} more variations for session ${sessionId}`)

    // Get session config
    const sessionConfig = await draftSessionService.getSessionConfig(sessionId)

    if (!sessionConfig) {
      return NextResponse.json(
        { error: 'Draft session not found' },
        { status: 404 }
      )
    }

    // Fetch source posts with all necessary data
    const sourcePosts = await prisma.tiktokPost.findMany({
      where: {
        id: {
          in: sessionConfig.sourcePostIds,
        },
      },
      include: {
        postCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (sourcePosts.length === 0) {
      return NextResponse.json(
        { error: 'No valid source posts found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const parsedSourcePosts: SourcePost[] = sourcePosts.map((post) => ({
      id: post.id,
      description: post.description,
      contentType: post.contentType,
      ocrTexts: typeof post.ocrTexts === 'string' ? JSON.parse(post.ocrTexts) : post.ocrTexts,
      imageDescriptions: typeof post.imageDescriptions === 'string'
        ? JSON.parse(post.imageDescriptions)
        : post.imageDescriptions,
      slideClassifications: typeof post.slideClassifications === 'string'
        ? JSON.parse(post.slideClassifications)
        : post.slideClassifications,
      category: post.postCategory,
    }))

    // Fetch product context if provided
    let productContext: { title: string; description: string } | undefined
    if (sessionConfig.productContextId) {
      const pc = await prisma.productContext.findUnique({
        where: { id: sessionConfig.productContextId },
        select: { title: true, description: true },
      })
      if (pc) {
        productContext = pc
      }
    }

    // Generate content using Gemini with session config
    const generationResult = await generateContent({
      sourcePosts: parsedSourcePosts,
      productContext,
      generationStrategy: sessionConfig.generationStrategy as 'remix' | 'inspired',
      languageStyle: sessionConfig.languageStyle,
      contentIdeas: sessionConfig.contentIdeas || undefined,
      variationCount,
      slidesRange: sessionConfig.slidesRange,
    })

    // Save each variation as a draft RemixPost linked to the existing session
    const createdDrafts = await Promise.all(
      generationResult.variations.map(async (variation) => {
        // Build slides array in RemixPost format
        const slides = variation.slides.map((slide) => ({
          id: crypto.randomUUID(),
          displayOrder: slide.slideIndex,
          paraphrasedText: slide.text,
          originalText: slide.sourcePostReference || '',
          canvas: {
            width: 1080,
            height: 1920,
            unit: 'px',
          },
          backgroundLayers: [],
          textBoxes: [],
          viewport: {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          },
        }))

        // Build slide classifications
        const slideClassifications = variation.slides.map((slide) => ({
          slideIndex: slide.slideIndex,
          type: slide.slideType.toUpperCase(),
          categoryName: variation.metadata.mainTheme,
        }))

        // Create the draft RemixPost
        const draft = await prisma.remixPost.create({
          data: {
            name: `Generated: ${variation.metadata.mainTheme}`,
            description: variation.metadata.description,
            generationType: sessionConfig.generationStrategy === 'remix' ? 'ai_remix' : 'ai_inspired',
            sourcePostIds: sessionConfig.sourcePostIds,
            productContextId: sessionConfig.productContextId || null,
            sessionId: sessionId, // Link to existing session
            languageStyleTags: [sessionConfig.languageStyle],
            generationPrompt: sessionConfig.languageStyle + (sessionConfig.contentIdeas ? `\n${sessionConfig.contentIdeas}` : ''),
            isDraft: true,
            slides: slides,
            slideClassifications: slideClassifications,
          },
        })

        return draft
      })
    )

    console.log(`✅ [API] Created ${createdDrafts.length} additional draft RemixPosts in session ${sessionId}`)

    return NextResponse.json({
      drafts: createdDrafts,
      count: createdDrafts.length,
      generationMetadata: generationResult.generationMetadata,
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('❌ [API] Variation generation failed:', error)

    Sentry.captureException(error, {
      tags: { operation: 'generate_variations_api' },
    })

    return NextResponse.json(
      {
        error: 'Failed to generate variations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
