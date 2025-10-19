import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: profileId } = await params
    const { searchParams } = new URL(request.url)

    // Optional date range filters
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const timezone = searchParams.get('timezone') || 'UTC'

    // Build where clause
    const where: any = {
      profileId: profileId,
      publishedAt: {
        not: null
      }
    }

    // Add date range filtering if provided
    if (dateFrom || dateTo) {
      where.publishedAt = {}
      if (dateFrom) {
        where.publishedAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.publishedAt.lte = new Date(dateTo)
      }
    }

    // Fetch all posts for this profile
    const posts = await prisma.tiktokPost.findMany({
      where,
      select: {
        publishedAt: true,
        viewCount: true,
        likeCount: true,
        commentCount: true
      }
    })

    // Group by hour in user's local timezone
    const hourlyMap = new Map<number, {
      postCount: number
      totalViews: number
      totalLikes: number
      totalComments: number
    }>()

    posts.forEach(post => {
      if (!post.publishedAt) return

      // Convert to user's timezone to extract hour
      // Use Intl.DateTimeFormat with the client's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      })
      const parts = formatter.formatToParts(post.publishedAt)
      const hourPart = parts.find(part => part.type === 'hour')
      const hour = hourPart ? parseInt(hourPart.value) : 0

      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, {
          postCount: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0
        })
      }

      const hourData = hourlyMap.get(hour)!
      hourData.postCount += 1
      hourData.totalViews += Number(post.viewCount || 0)
      hourData.totalLikes += post.likeCount || 0
      hourData.totalComments += post.commentCount || 0
    })

    // Convert to array and calculate averages
    const hourlyData = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({
        hour,
        postCount: data.postCount,
        totalViews: data.totalViews,
        avgViews: Math.round(data.totalViews / data.postCount),
        totalLikes: data.totalLikes,
        totalComments: data.totalComments,
        avgEngagementRate: (data.totalLikes + data.totalComments) / Math.max(data.totalViews, 1)
      }))
      .sort((a, b) => a.hour - b.hour)

    // Get top 3 hours by average views
    const bestTimes = hourlyData
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 3)
      .map(d => ({
        hour: d.hour,
        avgViews: d.avgViews,
        postCount: d.postCount
      }))

    return NextResponse.json({
      data: {
        hourlyData,
        bestTimes
      }
    })
  } catch (error) {
    console.error('Failed to fetch profile time analysis:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile time analysis' },
      { status: 500 }
    )
  }
}
