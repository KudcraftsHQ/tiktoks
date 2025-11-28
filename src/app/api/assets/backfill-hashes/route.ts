import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { hashBackfillQueue } from '@/lib/queue/hash-backfill-queue'

const prisma = new PrismaClient()

/**
 * POST /api/assets/backfill-hashes
 * Queue hash computation for assets without hashes
 *
 * Query params:
 * - limit: Maximum number of assets to queue (default: 100)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Find assets without hashes
    const assetsWithoutHash = await prisma.asset.findMany({
      where: {
        imageHash: null
      },
      select: {
        id: true,
        name: true
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (assetsWithoutHash.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No assets need hash computation',
        queued: 0
      })
    }

    // Queue hash backfill jobs
    const jobs = assetsWithoutHash.map(asset => ({
      assetId: asset.id
    }))

    await hashBackfillQueue.addBulkHashBackfillJobs(jobs)

    console.log(`✅ [HashBackfill] Queued ${jobs.length} assets for hash computation`)

    return NextResponse.json({
      success: true,
      message: `Queued ${jobs.length} assets for hash computation`,
      queued: jobs.length,
      assets: assetsWithoutHash.map(a => ({ id: a.id, name: a.name }))
    })
  } catch (error) {
    console.error('Failed to queue hash backfill jobs:', error)
    return NextResponse.json(
      {
        error: 'Failed to queue hash backfill jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/assets/backfill-hashes
 * Get statistics about assets with/without hashes
 */
export async function GET() {
  try {
    const [totalAssets, assetsWithHash, assetsWithoutHash, queueStats] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({
        where: {
          imageHash: {
            not: null
          }
        }
      }),
      prisma.asset.count({
        where: {
          imageHash: null
        }
      }),
      hashBackfillQueue.getStats()
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalAssets,
        assetsWithHash,
        assetsWithoutHash,
        percentageComplete: totalAssets > 0 ? Math.round((assetsWithHash / totalAssets) * 100) : 100
      },
      queue: queueStats
    })
  } catch (error) {
    console.error('Failed to get hash backfill stats:', error)
    return NextResponse.json(
      {
        error: 'Failed to get hash backfill stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
