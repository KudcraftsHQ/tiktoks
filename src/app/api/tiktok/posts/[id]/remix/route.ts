import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'
import { generateRemixContent, createRemixFromParaphrasing, GenerateRemixOptions } from '@/lib/paraphrasing-service'

const prisma = new PrismaClient()

const CreateRemixSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  options: z.object({
    theme: z.string().optional(),
    style: z.enum(['casual', 'professional', 'trendy', 'educational', 'humorous']).optional(),
    targetAudience: z.string().optional()
  }).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id

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
          details: validation.error.errors
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

    // Create the remix with generated content
    console.log(`🏗️ [API] Creating remix with ${remixContent.length} slides...`)
    const remixId = await createRemixFromParaphrasing(postId, remixContent, name, description)

    // Get the created remix with full data
    const createdRemix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        },
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

    console.log(`✅ [API] Successfully created remix: ${remixId}`)

    return NextResponse.json({
      success: true,
      message: 'Remix created successfully',
      remix: createdRemix,
      generatedContent: remixContent
    })

  } catch (error) {
    console.error(`❌ [API] Failed to create remix for post ${params.id}:`, error)

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
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    // Get all remixes for this post
    const remixes = await prisma.remixPost.findMany({
      where: { originalPostId: postId },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      postId,
      remixes,
      count: remixes.length
    })

  } catch (error) {
    console.error(`❌ [API] Failed to get remixes for post ${params.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get remixes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}