import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

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

    // Get the post with OCR status
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        ocrStatus: true,
        ocrProcessedAt: true,
        ocrTexts: true,
        contentType: true,
        images: true
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.contentType !== 'photo') {
      return NextResponse.json(
        { error: 'Post is not a photo carousel' },
        { status: 400 }
      )
    }

    const images = post.images as Array<{ cacheAssetId: string; width: number; height: number }>
    const ocrTexts = post.ocrTexts as Array<{ imageIndex: number; text: string; success: boolean; error?: string }>

    return NextResponse.json({
      postId: post.id,
      status: post.ocrStatus,
      processedAt: post.ocrProcessedAt,
      imageCount: images.length,
      ocrResults: ocrTexts,
      summary: {
        total: images.length,
        processed: ocrTexts.length,
        successful: ocrTexts.filter(r => r.success).length,
        failed: ocrTexts.filter(r => !r.success).length
      }
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to get OCR status for post ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get OCR status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}