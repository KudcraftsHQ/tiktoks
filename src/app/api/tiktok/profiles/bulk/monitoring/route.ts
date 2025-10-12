import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * PATCH /api/tiktok/profiles/bulk/monitoring
 * Bulk enable or disable monitoring for multiple profiles
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileIds, enabled } = body

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: profileIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: enabled must be a boolean' },
        { status: 400 }
      )
    }

    // Calculate next monitoring run (24 hours from now if enabling)
    const nextMonitoringRun = enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null

    // Update all profiles in a single transaction
    const result = await prisma.tiktokProfile.updateMany({
      where: {
        id: {
          in: profileIds
        }
      },
      data: {
        monitoringEnabled: enabled,
        nextMonitoringRun: enabled ? nextMonitoringRun : null,
        updatedAt: new Date()
      }
    })

    console.log(`${enabled ? '✅ Enabled' : '⏸️ Disabled'} monitoring for ${result.count} profiles`)

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      enabled
    })
  } catch (error) {
    console.error('Failed to bulk update monitoring status:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update monitoring status' },
      { status: 500 }
    )
  }
}
