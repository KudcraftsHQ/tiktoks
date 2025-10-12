import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { profileMonitorQueue } from '@/lib/queue/profile-monitor-queue'

const prisma = new PrismaClient()

/**
 * POST /api/tiktok/profiles/bulk/trigger
 * Manually trigger monitoring for multiple profiles (force update)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileIds } = body

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

    // Queue monitoring jobs for all profiles with high priority
    const queuePromises = profiles.map(profile =>
      profileMonitorQueue.addMonitorJob(profile.id, 10)
    )

    await Promise.all(queuePromises)

    const handles = profiles.map(p => `@${p.handle}`).join(', ')
    console.log(`✅ [BulkTrigger] Queued monitoring jobs for ${profiles.length} profiles: ${handles}`)

    return NextResponse.json({
      success: true,
      message: `Monitoring queued for ${profiles.length} profile${profiles.length > 1 ? 's' : ''}`,
      queuedCount: profiles.length,
      profileIds: profiles.map(p => p.id)
    })
  } catch (error) {
    console.error('Failed to bulk trigger monitoring:', error)
    return NextResponse.json(
      { error: 'Failed to bulk trigger monitoring' },
      { status: 500 }
    )
  }
}
