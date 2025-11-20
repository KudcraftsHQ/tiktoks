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
    const profiles = await prisma.tiktokProfile.findMany({
      where: profileWhere,
      select: {
        id: true,
        posts: {
          select: {
            id: true,
            publishedAt: true,
            viewCount: true
          },
          where: {
            publishedAt: {
              lte: toDate
            }
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

    // Create a map of dates to view counts
    const dateViewsMap = new Map<string, { views: bigint; isEstimated: boolean }>()

    // Group metrics by date
    const metricsByDate = new Map<string, Map<string, bigint>>()

    metricsHistory.forEach(metric => {
      const dateKey = format(startOfDay(metric.recordedAt), 'yyyy-MM-dd')

      if (!metricsByDate.has(dateKey)) {
        metricsByDate.set(dateKey, new Map())
      }

      const dayMetrics = metricsByDate.get(dateKey)!
      const currentViews = dayMetrics.get(metric.postId) || BigInt(0)
      const newViews = metric.viewCount || BigInt(0)

      // Keep the latest (highest) view count for each post on each day
      if (newViews > currentViews) {
        dayMetrics.set(metric.postId, newViews)
      }
    })

    // Calculate total views per day
    metricsByDate.forEach((postViews, dateKey) => {
      let totalViews = BigInt(0)
      postViews.forEach(views => {
        totalViews += views
      })

      dateViewsMap.set(dateKey, {
        views: totalViews,
        isEstimated: false
      })
    })

    // Fill in missing dates with estimates
    const allDates = eachDayOfInterval({ start: fromDate, end: toDate })

    allDates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd')

      if (!dateViewsMap.has(dateKey)) {
        // For missing dates, calculate based on post publish dates and current totals
        let estimatedViews = BigInt(0)

        profiles.forEach(profile => {
          profile.posts.forEach(post => {
            if (post.publishedAt && post.publishedAt <= date) {
              // Post existed at this date, use its current view count
              estimatedViews += post.viewCount || BigInt(0)
            }
          })
        })

        dateViewsMap.set(dateKey, {
          views: estimatedViews,
          isEstimated: true
        })
      }
    })

    // Convert to array and sort by date
    const dailyViewsData = Array.from(dateViewsMap.entries())
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
