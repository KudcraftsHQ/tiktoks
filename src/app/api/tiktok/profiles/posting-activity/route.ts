import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { startOfDay, format } from 'date-fns'

const prisma = new PrismaClient()

/**
 * GET /api/tiktok/profiles/posting-activity
 * Returns posting activity (post count per day) for profiles within a date range
 *
 * Query params:
 * - dateFrom: ISO date string (required)
 * - dateTo: ISO date string (required)
 * - groupId: string (optional) - filter by profile group
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const groupId = searchParams.get('groupId')

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'dateFrom and dateTo are required' },
        { status: 400 }
      )
    }

    const fromDate = startOfDay(new Date(dateFrom))
    const toDate = startOfDay(new Date(dateTo))
    // Set toDate to end of day
    toDate.setHours(23, 59, 59, 999)

    // Build where clause for profiles
    const profileWhere: Record<string, unknown> = {}
    if (groupId) {
      if (groupId === 'ungrouped') {
        profileWhere.profileGroupId = null
      } else if (groupId !== 'all') {
        profileWhere.profileGroupId = groupId
      }
    }

    // Get profile IDs matching the filter
    const profiles = await prisma.tiktokProfile.findMany({
      where: profileWhere,
      select: {
        id: true
      }
    })

    const profileIds = profiles.map(p => p.id)

    if (profileIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Get posts published within the date range for these profiles
    const posts = await prisma.tiktokPost.findMany({
      where: {
        profileId: { in: profileIds },
        publishedAt: {
          gte: fromDate,
          lte: toDate
        }
      },
      select: {
        publishedAt: true
      }
    })

    // Group posts by date
    const dateCountMap = new Map<string, number>()

    posts.forEach(post => {
      if (post.publishedAt) {
        const dateKey = format(startOfDay(post.publishedAt), 'yyyy-MM-dd')
        const currentCount = dateCountMap.get(dateKey) || 0
        dateCountMap.set(dateKey, currentCount + 1)
      }
    })

    // Convert to array format expected by the heatmap
    const activityData = Array.from(dateCountMap.entries())
      .map(([date, count]) => ({
        date,
        count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: activityData
    })
  } catch (error) {
    console.error('Failed to fetch posting activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posting activity data' },
      { status: 500 }
    )
  }
}
