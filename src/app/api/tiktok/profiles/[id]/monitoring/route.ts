import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * GET /api/tiktok/profiles/[id]/monitoring
 * Get monitoring status and recent logs for a profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const profile = await prisma.tiktokProfile.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        monitoringEnabled: true,
        lastMonitoringRun: true,
        nextMonitoringRun: true,
        monitoringLogs: {
          orderBy: {
            startedAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      monitoringEnabled: profile.monitoringEnabled,
      lastMonitoringRun: profile.lastMonitoringRun,
      nextMonitoringRun: profile.nextMonitoringRun,
      recentLogs: profile.monitoringLogs
    })
  } catch (error) {
    console.error('Failed to fetch monitoring status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring status' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/tiktok/profiles/[id]/monitoring
 * Enable or disable monitoring for a profile
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: enabled must be a boolean' },
        { status: 400 }
      )
    }

    // Calculate next monitoring run (24 hours from now if enabling)
    const nextMonitoringRun = enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null

    const profile = await prisma.tiktokProfile.update({
      where: { id },
      data: {
        monitoringEnabled: enabled,
        nextMonitoringRun: enabled ? nextMonitoringRun : null,
        updatedAt: new Date()
      }
    })

    console.log(`${enabled ? '✅ Enabled' : '⏸️ Disabled'} monitoring for @${profile.handle}`)

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        handle: profile.handle,
        monitoringEnabled: profile.monitoringEnabled,
        lastMonitoringRun: profile.lastMonitoringRun,
        nextMonitoringRun: profile.nextMonitoringRun
      }
    })
  } catch (error) {
    console.error('Failed to update monitoring status:', error)
    return NextResponse.json(
      { error: 'Failed to update monitoring status' },
      { status: 500 }
    )
  }
}
