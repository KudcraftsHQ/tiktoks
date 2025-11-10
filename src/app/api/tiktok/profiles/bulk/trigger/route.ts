import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { profileMonitorQueue } from '@/lib/queue/profile-monitor-queue'

const prisma = new PrismaClient()

/**
 * POST /api/tiktok/profiles/bulk/trigger
 * Manually trigger monitoring for multiple profiles (force update)
 *
 * Body params:
 * - profileIds: string[] - Array of profile IDs to update
 * - forceRecache: boolean - If true, forces recaching of all media assets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileIds, forceRecache = false } = body

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: profileIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Fetch profiles to verify they exist and get handles for logging
    const profiles = await prisma.tiktokProfile.findMany({
      where: {
        id: {
          in: profileIds
        }
      },
      select: {
        id: true,
        handle: true
      }
    })

    if (profiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid profiles found' },
        { status: 404 }
      )
    }

    // Queue monitoring jobs for all profiles with high priority and forceRecache option
    const queuePromises = profiles.map(profile =>
      profileMonitorQueue.addMonitorJob(profile.id, 10, { forceRecache })
    )

    await Promise.all(queuePromises)

    const handles = profiles.map(p => `@${p.handle}`).join(', ')
    console.log(`✅ [BulkTrigger] Queued monitoring jobs for ${profiles.length} profiles: ${handles}`, {
      forceRecache
    })

    return NextResponse.json({
      success: true,
      message: `Monitoring queued for ${profiles.length} profile${profiles.length > 1 ? 's' : ''}${forceRecache ? ' with force recache' : ''}`,
      queuedCount: profiles.length,
      profileIds: profiles.map(p => p.id),
      forceRecache
    })
  } catch (error) {
    console.error('Failed to bulk trigger monitoring:', error)
    return NextResponse.json(
      { error: 'Failed to bulk trigger monitoring' },
      { status: 500 }
    )
  }
}
