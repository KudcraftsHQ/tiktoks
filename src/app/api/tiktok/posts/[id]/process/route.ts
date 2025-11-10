import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { performOCRForTikTokPost } from '@/lib/ocr-service'

const prisma = new PrismaClient()

/**
 * POST /api/tiktok/posts/:id/process
 * Run OCR + Classification in one go
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const postId = resolvedParams.id

    console.log(`🔄 [API] Processing post ${postId} (OCR + Classification)...`)

    // Get the post
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId },
      include: { profile: true }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.contentType !== 'photo') {
      return NextResponse.json(
        { error: 'Only photo posts can be processed' },
        { status: 400 }
      )
    }

    // Run OCR + Classification (performOCRForTikTokPost handles both and all status updates)
    console.log(`📝 [API] Running OCR + Classification on ${post.images ? (post.images as any[]).length : 0} images...`)
    await performOCRForTikTokPost(postId)

    console.log(`✅ [API] OCR and classification completed`)

    // Get final updated post
    const finalPost = await prisma.tiktokPost.findUnique({
      where: { id: postId }
    })

    return NextResponse.json({
      success: true,
      message: 'OCR and classification completed',
      ocrResults: finalPost?.ocrTexts,
      imageDescriptions: finalPost?.imageDescriptions,
      slideClassifications: finalPost?.slideClassifications,
      ocrData: finalPost?.ocrData,
      post: {
        id: post.id,
        ocrStatus: finalPost?.ocrStatus,
        ocrProcessedAt: finalPost?.ocrProcessedAt,
        classificationStatus: finalPost?.classificationStatus,
        classificationProcessedAt: finalPost?.classificationProcessedAt,
        postCategoryId: finalPost?.postCategoryId,
        categoryConfidence: finalPost?.categoryConfidence
      }
    })
  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Processing failed for post ${resolvedParams?.id}:`, error)

    // Update status to failed (performOCRForTikTokPost already handles failure status)
    if (resolvedParams?.id) {
      await prisma.tiktokPost.update({
        where: { id: resolvedParams.id },
        data: {
          ocrStatus: 'failed'
        }
      }).catch(() => {})
    }

    return NextResponse.json(
      {
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
