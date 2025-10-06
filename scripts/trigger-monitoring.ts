#!/usr/bin/env tsx

/**
 * Trigger Profile Monitoring Script
 *
 * This script finds all profiles with monitoring enabled that are due for monitoring
 * and enqueues them to the profile-monitor queue.
 *
 * Usage:
 *   pnpm tsx scripts/trigger-monitoring.ts
 *
 * Coolify Scheduled Task Configuration:
 *   Name: "Profile Monitoring Trigger"
 *   Command: pnpm tsx scripts/trigger-monitoring.ts
 *   Frequency: 0 * * * * (every hour)
 *   Container: Main app container
 */

import { PrismaClient } from '@/generated/prisma'
import { profileMonitorQueue } from '@/lib/queue/profile-monitor-queue'

const prisma = new PrismaClient()

async function triggerMonitoring() {
  console.log('🚀 [TriggerMonitoring] Starting profile monitoring trigger...')
  console.log(`📅 [TriggerMonitoring] Current time: ${new Date().toISOString()}`)

  try {
    // Find all profiles with monitoring enabled that are due for monitoring
    const now = new Date()
    const eligibleProfiles = await prisma.tiktokProfile.findMany({
      where: {
        monitoringEnabled: true,
        OR: [
          {
            nextMonitoringRun: {
              lte: now
            }
          },
          {
            nextMonitoringRun: null
          }
        ]
      },
      select: {
        id: true,
        handle: true,
        lastMonitoringRun: true,
        nextMonitoringRun: true
      }
    })

    console.log(`📊 [TriggerMonitoring] Found ${eligibleProfiles.length} profiles due for monitoring`)

    if (eligibleProfiles.length === 0) {
      console.log('✅ [TriggerMonitoring] No profiles due for monitoring at this time')
      await cleanup()
      return
    }

    // Log the profiles
    eligibleProfiles.forEach(profile => {
      console.log(`👤 [TriggerMonitoring] @${profile.handle} - Last run: ${profile.lastMonitoringRun?.toISOString() || 'Never'}, Next run: ${profile.nextMonitoringRun?.toISOString() || 'Not scheduled'}`)
    })

    // Enqueue monitoring jobs
    const profileIds = eligibleProfiles.map(p => p.id)
    await profileMonitorQueue.addBulkMonitorJobs(profileIds)

    console.log(`✅ [TriggerMonitoring] Successfully enqueued ${profileIds.length} monitoring jobs`)

    // Get queue stats
    const stats = await profileMonitorQueue.getStats()
    console.log('📊 [TriggerMonitoring] Queue stats:', stats)

    await cleanup()
  } catch (error) {
    console.error('❌ [TriggerMonitoring] Error triggering monitoring:', error)
    await cleanup()
    process.exit(1)
  }
}

async function cleanup() {
  await prisma.$disconnect()
  await profileMonitorQueue.close()
}

// Run the script
triggerMonitoring()
  .then(() => {
    console.log('✅ [TriggerMonitoring] Trigger completed successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ [TriggerMonitoring] Fatal error:', error)
    process.exit(1)
  })
