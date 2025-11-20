import { NextRequest, NextResponse } from 'next/server'
import { performOCRForTikTokPost } from '@/lib/ocr-service'
import { PrismaClient } from '@/generated/prisma'

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

    console.log(`🔍 [API] Starting OCR for TikTokPost: ${postId}`)

    // Trigger OCR processing for the post
    await performOCRForTikTokPost(postId)

    return NextResponse.json({
      success: true,
      message: 'OCR processing completed successfully',
      postId
    })

  } catch (error) {
    const resolvedParams = await params.catch(() => ({ id: 'unknown' }))
    console.error(`❌ [API] OCR failed for post ${resolvedParams?.id || 'unknown'}:`, error)

    return NextResponse.json(
      {
        error: 'OCR processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const { slideIndex, text } = body

    if (slideIndex === undefined || text === undefined) {
      return NextResponse.json(
        { error: 'slideIndex and text are required in request body' },
        { status: 400 }
      )
    }

    // Fetch the post
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Parse OCR texts
    let ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }> = []
    try {
      ocrTexts = typeof post.ocrTexts === 'string'
        ? JSON.parse(post.ocrTexts)
        : (Array.isArray(post.ocrTexts) ? post.ocrTexts : [])
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse OCR texts' },
        { status: 500 }
      )
    }

    // Find and update the OCR text for the specific slide
    const ocrIndex = ocrTexts.findIndex(ocr => ocr.imageIndex === slideIndex)

    if (ocrIndex >= 0) {
      // Update existing OCR text
      ocrTexts[ocrIndex] = {
        ...ocrTexts[ocrIndex],
        text,
        success: true
      }
    } else {
      // Add new OCR text entry
      ocrTexts.push({
        imageIndex: slideIndex,
        text,
        success: true
      })
    }

    // Update the post with modified OCR texts
    await prisma.tiktokPost.update({
      where: { id: postId },
      data: {
        ocrTexts: ocrTexts,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'OCR text updated successfully',
      slideIndex,
      text
    })

  } catch (error) {
    const resolvedParams = await params.catch(() => ({ id: 'unknown' }))
    console.error(`❌ [API] Failed to update OCR text for post ${resolvedParams?.id || 'unknown'}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update OCR text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}