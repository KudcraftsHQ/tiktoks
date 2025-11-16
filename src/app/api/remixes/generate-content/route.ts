import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { generateContent, SourcePost } from '@/lib/content-generation-service'
import { draftSessionService } from '@/lib/draft-session-service'
import * as Sentry from '@sentry/nextjs'

const prisma = new PrismaClient()

const generateContentSchema = z.object({
  selectedPostIds: z.array(z.string()).min(1, 'At least one post is required'),
  productContextId: z.string().optional(),
  projectId: z.string().optional(),
  generationStrategy: z.enum(['remix', 'inspired']).default('remix'),
  languageStyle: z.string().min(1, 'Language style is required'),
  contentIdeas: z.string().optional(),
  variationCount: z.number().int().min(1).max(50).default(5),
  slidesRange: z.object({
    min: z.number().int().min(3).max(15),
    max: z.number().int().min(3).max(20),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      selectedPostIds,
      productContextId,
      projectId,
      generationStrategy,
      languageStyle,
      contentIdeas,
      variationCount,
      slidesRange,
    } = generateContentSchema.parse(body)

    console.log(`📝 [API] Starting content generation for ${selectedPostIds.length} posts`)

    // Validate slides range
    if (slidesRange.min > slidesRange.max) {
      return NextResponse.json(
        { error: 'Minimum slides cannot be greater than maximum slides' },
        { status: 400 }
      )
    }

    // Fetch source posts with all necessary data
    const sourcePosts = await prisma.tiktokPost.findMany({
      where: {
        id: {
          in: selectedPostIds,
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
    if (productContextId) {
      const pc = await prisma.productContext.findUnique({
        where: { id: productContextId },
        select: { title: true, description: true },
      })
      if (pc) {
        productContext = pc
      }
    }

    // Generate content using Gemini
    const generationResult = await generateContent({
      sourcePosts: parsedSourcePosts,
      productContext,
      generationStrategy,
      languageStyle,
      contentIdeas,
      variationCount,
      slidesRange,
    })

    // Create a draft session to group these variations
    const session = await draftSessionService.createDraftSession({
      generationStrategy,
      languageStyle,
      contentIdeas,
      slidesRange,
      productContextId,
      sourcePostIds: selectedPostIds,
    })

    console.log(`📁 [API] Created draft session: ${session.id}`)

    // Save each variation as a draft RemixPost linked to the session
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
            name: `${variation.metadata.mainTheme}`,
            description: variation.metadata.description, // AI-generated cohesive narrative
            generationType: generationStrategy === 'remix' ? 'ai_remix' : 'ai_inspired',
            sourcePostIds: selectedPostIds,
            productContextId: productContextId || null,
            projectId: projectId || null,
            sessionId: session.id, // Link to session
            languageStyleTags: [languageStyle],
            generationPrompt: languageStyle + (contentIdeas ? `\n${contentIdeas}` : ''),
            isDraft: true,
            slides: slides,
            slideClassifications: slideClassifications,
          },
        })

        return draft
      })
    )

    console.log(`✅ [API] Created ${createdDrafts.length} draft RemixPosts in session ${session.id}`)

    return NextResponse.json({
      sessionId: session.id, // Return session ID for navigation
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

    console.error('❌ [API] Content generation failed:', error)

    // Report to Sentry
    Sentry.captureException(error, {
      tags: { operation: 'content_generation_api' },
    })

    return NextResponse.json(
      {
        error: 'Failed to generate content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
