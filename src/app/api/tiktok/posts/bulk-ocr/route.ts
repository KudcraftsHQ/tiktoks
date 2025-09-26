import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { performBatchOCRForTikTokPosts } from '@/lib/ocr-service'

const BulkOCRSchema = z.object({
  postIds: z.array(z.string()).min(1).max(50), // Limit to 50 posts per batch
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = BulkOCRSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { postIds } = validation.data

    console.log(`🚀 [API] Starting bulk OCR for ${postIds.length} posts`)

    // Process the batch OCR
    const results = await performBatchOCRForTikTokPosts(postIds)

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }

    console.log(`✅ [API] Bulk OCR completed: ${summary.successful}/${summary.total} successful`)

    return NextResponse.json({
      success: true,
      message: 'Batch OCR processing completed',
      summary,
      results
    })

  } catch (error) {
    console.error('❌ [API] Bulk OCR failed:', error)

    return NextResponse.json(
      {
        error: 'Batch OCR processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}