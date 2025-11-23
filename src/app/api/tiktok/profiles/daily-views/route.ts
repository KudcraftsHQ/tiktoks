import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { startOfDay, eachDayOfInterval, format } from 'date-fns'

const prisma = new PrismaClient()

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

    // Build where clause for profiles
    const profileWhere: any = {}
    if (groupId) {
      if (groupId === 'ungrouped') {
        profileWhere.profileGroupId = null
      } else if (groupId !== 'all') {
        profileWhere.profileGroupId = groupId
      }
    }

    // Get all profiles matching the filter
    // Include ALL posts - we calculate gains from metrics history within date range
    const profiles = await prisma.tiktokProfile.findMany({
      where: profileWhere,
      select: {
        id: true,
        posts: {
          select: {
            id: true
          }
        }
      }
    })

    // Get all post IDs
    const postIds = profiles.flatMap(p => p.posts.map(post => post.id))

    if (postIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Fetch metrics history for all posts within the date range
    const metricsHistory = await prisma.tikTokPostMetricsHistory.findMany({
      where: {
        postId: { in: postIds },
        recordedAt: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: {
        recordedAt: 'asc'
      },
      select: {
        postId: true,
        viewCount: true,
        recordedAt: true
      }
    })

    // Group metrics by postId, then by date to track cumulative views per post per day
    // Structure: postId -> date -> viewCount (cumulative)
    const postMetricsByDate = new Map<string, Map<string, bigint>>()

    metricsHistory.forEach(metric => {
      const dateKey = format(startOfDay(metric.recordedAt), 'yyyy-MM-dd')
      const postId = metric.postId
      const viewCount = metric.viewCount || BigInt(0)

      if (!postMetricsByDate.has(postId)) {
        postMetricsByDate.set(postId, new Map())
      }

      const postDates = postMetricsByDate.get(postId)!
      const existingViews = postDates.get(dateKey) || BigInt(0)

      // Keep the highest view count for each post on each day
      if (viewCount > existingViews) {
        postDates.set(dateKey, viewCount)
      }
    })

    // Calculate daily views gained per post (difference between consecutive days)
    // Then aggregate across all posts for each day
    const dailyViewsMap = new Map<string, { views: bigint; isEstimated: boolean }>()
    const allDates = eachDayOfInterval({ start: fromDate, end: toDate })
    const allDateKeys = allDates.map(d => format(d, 'yyyy-MM-dd'))

    // For each post, calculate daily view gains
    postMetricsByDate.forEach((dateMetrics, postId) => {
      const sortedDates = Array.from(dateMetrics.keys()).sort()

      sortedDates.forEach((dateKey, index) => {
        const currentViews = dateMetrics.get(dateKey)!

        let dailyGain = BigInt(0)
        if (index === 0) {
          // First recorded day for this post - we don't know how many views it gained
          // Could be 0 or could be all of them, so we skip (treat as 0 gain)
          dailyGain = BigInt(0)
        } else {
          const prevDate = sortedDates[index - 1]
          const prevViews = dateMetrics.get(prevDate)!
          dailyGain = currentViews - prevViews
          if (dailyGain < BigInt(0)) dailyGain = BigInt(0) // Safety check
        }

        // Add to daily total
        const existing = dailyViewsMap.get(dateKey) || { views: BigInt(0), isEstimated: false }
        dailyViewsMap.set(dateKey, {
          views: existing.views + dailyGain,
          isEstimated: false
        })
      })
    })

    // Fill in missing dates with 0 (no data means no recorded gains)
    allDateKeys.forEach(dateKey => {
      if (!dailyViewsMap.has(dateKey)) {
        dailyViewsMap.set(dateKey, {
          views: BigInt(0),
          isEstimated: true
        })
      }
    })

    // Convert to array and sort by date
    const dailyViewsData = Array.from(dailyViewsMap.entries())
      .map(([date, data]) => ({
        date,
        views: Number(data.views),
        isEstimated: data.isEstimated
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: dailyViewsData
    })
  } catch (error) {
    console.error('Failed to fetch daily views:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily views data' },
      { status: 500 }
    )
  }
}
