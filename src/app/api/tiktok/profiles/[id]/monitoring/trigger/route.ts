import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { profileMonitorQueue } from '@/lib/queue/profile-monitor-queue'

const prisma = new PrismaClient()

/**
 * POST /api/tiktok/profiles/[id]/monitoring/trigger
 * Manually trigger monitoring for a profile (force update)
 *
 * Body params:
 * - forceRecache: boolean - If true, forces recaching of all media assets
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { forceRecache = false } = body as { forceRecache?: boolean }

    // Check if profile exists
    const profile = await prisma.tiktokProfile.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        monitoringEnabled: true
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Queue the monitoring job with options
    await profileMonitorQueue.addMonitorJob(profile.id, 10, { forceRecache }) // Higher priority for manual triggers

    console.log(`✅ [ManualTrigger] Queued monitoring job for @${profile.handle}`, {
      forceRecache
    })

    return NextResponse.json({
      success: true,
      message: `Monitoring queued for @${profile.handle}${forceRecache ? ' (force recache enabled)' : ''}`,
      profileId: profile.id,
      forceRecache
    })
  } catch (error) {
    console.error('Failed to trigger monitoring:', error)
    return NextResponse.json(
      { error: 'Failed to trigger monitoring' },
      { status: 500 }
    )
  }
}
