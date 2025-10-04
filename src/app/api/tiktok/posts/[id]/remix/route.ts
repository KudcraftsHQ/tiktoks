import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { CreateRemixSchema, GenerateRemixOptions, CANVAS_SIZES, createDefaultBackgroundLayers } from '@/lib/validations/remix-schema'
import { generateRemixContent } from '@/lib/paraphrasing-service'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const postId = resolvedParams.id

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = CreateRemixSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { name, description, options = {} } = validation.data

    console.log(`🎬 [API] Creating remix for TikTokPost: ${postId}`)

    // Get the original post with OCR data
    const originalPost = await prisma.tiktokPost.findUnique({
      where: { id: postId },
      include: {
        profile: true
      }
    })

    if (!originalPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (originalPost.contentType !== 'photo') {
      return NextResponse.json(
        { error: 'Only photo carousels can be remixed' },
        { status: 400 }
      )
    }

    if (originalPost.ocrStatus !== 'completed') {
      return NextResponse.json(
        {
          error: 'OCR processing must be completed before creating a remix',
          ocrStatus: originalPost.ocrStatus
        },
        { status: 400 }
      )
    }

    // Generate paraphrased content
    console.log(`🤖 [API] Generating paraphrased content...`)
    const remixContent = await generateRemixContent(originalPost, options as GenerateRemixOptions)

    // Transform remix content to new slide structure
    const slides = remixContent.map((content, index) => ({
      id: `slide_${Date.now()}_${index}`,
      displayOrder: index,
      canvas: options.canvasSize || CANVAS_SIZES.INSTAGRAM_STORY,
      backgroundLayers: createDefaultBackgroundLayers(),
      originalImageIndex: content.imageIndex,
      paraphrasedText: content.paraphrasedText,
      originalText: '', // Will be populated from OCR data
      textBoxes: [] // Start with empty text boxes, user can add more
    }))

    // Create the remix with new JSON structure
    console.log(`🏗️ [API] Creating remix with ${slides.length} slides...`)
    const createdRemix = await prisma.remixPost.create({
      data: {
        originalPostId: postId,
        name,
        description,
        generationType: 'ai_paraphrase',
        slides: JSON.stringify(slides)
      },
      include: {
        originalPost: {
          select: {
            id: true,
            tiktokUrl: true,
            authorNickname: true,
            authorHandle: true,
            description: true,
            images: true
          }
        }
      }
    })

    // Parse slides for response
    const remixWithParsedSlides = {
      ...createdRemix,
      slides: slides
    }

    console.log(`✅ [API] Successfully created remix: ${createdRemix.id}`)

    return NextResponse.json({
      success: true,
      message: 'Remix created successfully',
      remix: remixWithParsedSlides,
      generatedContent: remixContent
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to create remix for post ${resolvedParams?.id || 'unknown'}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to create remix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const postId = resolvedParams.id

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    // Get all remixes for this post
    const remixes = await prisma.remixPost.findMany({
      where: { originalPostId: postId },
      orderBy: { createdAt: 'desc' }
    })

    // Parse the JSON slides for each remix
    const remixesWithParsedSlides = remixes.map(remix => ({
      ...remix,
      slides: typeof remix.slides === 'string' ? JSON.parse(remix.slides) : remix.slides
    }))

    return NextResponse.json({
      postId,
      remixes: remixesWithParsedSlides,
      count: remixes.length
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to get remixes for post ${resolvedParams?.id || 'unknown'}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get remixes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}