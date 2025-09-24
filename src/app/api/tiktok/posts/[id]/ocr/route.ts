import { NextRequest, NextResponse } from 'next/server'
import { performOCRForTikTokPost } from '@/lib/ocr-service'

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

    console.log(`🔍 [API] Starting OCR for TikTokPost: ${postId}`)

    // Trigger OCR processing for the post
    await performOCRForTikTokPost(postId)

    return NextResponse.json({
      success: true,
      message: 'OCR processing completed successfully',
      postId
    })

  } catch (error) {
    console.error(`❌ [API] OCR failed for post ${params.id}:`, error)

    return NextResponse.json(
      {
        error: 'OCR processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}