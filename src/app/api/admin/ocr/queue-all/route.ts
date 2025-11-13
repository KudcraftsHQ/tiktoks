import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { ocrQueue } from '@/lib/queue/ocr-queue'

const prisma = new PrismaClient()

/**
 * POST /api/admin/ocr/queue-all
 * Queue OCR jobs for all photo posts that haven't been OCR'd yet
 */
export async function POST(request: NextRequest) {
  try {
    console.log(`🔍 [AdminOCR] Finding photo posts without OCR...`)

    // Find all photo posts that need OCR
    const postsNeedingOCR = await prisma.tiktokPost.findMany({
      where: {
        contentType: 'photo',
        OR: [
          { ocrStatus: 'pending' },
          { ocrStatus: 'failed' }
        ]
      },
      select: {
        id: true,
        tiktokId: true,
        ocrStatus: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`📊 [AdminOCR] Found ${postsNeedingOCR.length} posts needing OCR`)

    if (postsNeedingOCR.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts need OCR processing',
        stats: {
          total: 0,
          queued: 0
        }
      })
    }

    // Queue OCR jobs for all these posts
    const postIds = postsNeedingOCR.map(p => p.id)

    console.log(`📋 [AdminOCR] Queuing ${postIds.length} OCR jobs...`)
    await ocrQueue.addBulkOCRJobs(postIds)

    console.log(`✅ [AdminOCR] Successfully queued ${postIds.length} OCR jobs`)

    // Get queue stats
    const queueStats = await ocrQueue.getStats()

    return NextResponse.json({
      success: true,
      message: `Queued ${postIds.length} posts for OCR processing`,
      stats: {
        total: postsNeedingOCR.length,
        queued: postIds.length,
        byStatus: {
          pending: postsNeedingOCR.filter(p => p.ocrStatus === 'pending').length,
          failed: postsNeedingOCR.filter(p => p.ocrStatus === 'failed').length
        }
      },
      queueStats
    })
  } catch (error) {
    console.error('❌ [AdminOCR] Failed to queue OCR jobs:', error)

    return NextResponse.json(
      {
        error: 'Failed to queue OCR jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/ocr/queue-all
 * Get statistics about posts needing OCR and current queue status
 */
export async function GET(request: NextRequest) {
  try {
    console.log(`🔍 [AdminOCR] Getting OCR statistics...`)

    // Count posts by OCR status
    const [pendingCount, processingCount, completedCount, failedCount, totalPhotoCount] = await Promise.all([
      prisma.tiktokPost.count({
        where: {
          contentType: 'photo',
          ocrStatus: 'pending'
        }
      }),
      prisma.tiktokPost.count({
        where: {
          contentType: 'photo',
          ocrStatus: 'processing'
        }
      }),
      prisma.tiktokPost.count({
        where: {
          contentType: 'photo',
          ocrStatus: 'completed'
        }
      }),
      prisma.tiktokPost.count({
        where: {
          contentType: 'photo',
          ocrStatus: 'failed'
        }
      }),
      prisma.tiktokPost.count({
        where: {
          contentType: 'photo'
        }
      })
    ])

    const needsOCR = pendingCount + failedCount

    // Get queue stats
    const queueStats = await ocrQueue.getStats()

    console.log(`✅ [AdminOCR] Statistics retrieved successfully`)

    return NextResponse.json({
      success: true,
      stats: {
        totalPhotoPosts: totalPhotoCount,
        needsOCR,
        byStatus: {
          pending: pendingCount,
          processing: processingCount,
          completed: completedCount,
          failed: failedCount
        }
      },
      queueStats
    })
  } catch (error) {
    console.error('❌ [AdminOCR] Failed to get statistics:', error)

    return NextResponse.json(
      {
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
