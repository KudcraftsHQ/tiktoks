import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { performOCRForTikTokPost } from '@/lib/ocr-service'

const prisma = new PrismaClient()

/**
 * POST /api/tiktok/posts/batch-process
 * Run OCR + Classification on multiple posts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postIds } = body as { postIds: string[] }

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'postIds array is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 [API] Batch processing ${postIds.length} posts...`)

    const results = []
    const errors = []

    for (const postId of postIds) {
      try {
        console.log(`  📝 Processing post ${postId}...`)

        // Get the post
        const post = await prisma.tiktokPost.findUnique({
          where: { id: postId },
          include: { profile: true }
        })

        if (!post) {
          errors.push({ postId, error: 'Post not found' })
          continue
        }

        if (post.contentType !== 'photo') {
          errors.push({ postId, error: 'Only photo posts can be processed' })
          continue
        }

        // Run OCR (performOCRForTikTokPost handles OCR, classification, and saving all results)
        await performOCRForTikTokPost(postId)

        // Get updated post with OCR results
        const updatedPost = await prisma.tiktokPost.findUnique({
          where: { id: postId }
        })

        // Parse results to get counts
        let ocrResultCount = 0
        let classificationCount = 0

        try {
          const parsedOcrTexts = JSON.parse(updatedPost?.ocrTexts as string || '[]')
          ocrResultCount = Array.isArray(parsedOcrTexts) ? parsedOcrTexts.length : 0
        } catch {
          ocrResultCount = 0
        }

        try {
          const parsedClassifications = JSON.parse(updatedPost?.slideClassifications as string || '[]')
          classificationCount = Array.isArray(parsedClassifications) ? parsedClassifications.length : 0
        } catch {
          classificationCount = 0
        }

        results.push({
          postId,
          success: true,
          ocrResultCount,
          classificationCount
        })

        console.log(`  ✅ Completed ${postId}`)
      } catch (error) {
        console.error(`  ❌ Failed ${postId}:`, error)
        errors.push({
          postId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        // Update status to failed (classification is already handled by performOCRForTikTokPost)
        await prisma.tiktokPost.update({
          where: { id: postId },
          data: {
            ocrStatus: 'failed'
          }
        }).catch(() => {})
      }
    }

    console.log(`✅ [API] Batch processing completed. Success: ${results.length}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} of ${postIds.length} posts`,
      results,
      errors,
      summary: {
        total: postIds.length,
        successful: results.length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('❌ [API] Batch processing failed:', error)

    return NextResponse.json(
      {
        error: 'Batch processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
