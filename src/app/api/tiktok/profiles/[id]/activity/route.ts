import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: profileId } = await params

    // Get the start of the current year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1)
    startOfYear.setHours(0, 0, 0, 0)

    // Get the end of today
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    // Query posts grouped by date (using publishedAt for actual TikTok posting date)
    const posts = await prisma.tiktokPost.findMany({
      where: {
        profileId: profileId,
        publishedAt: {
          gte: startOfYear,
          lte: endOfToday,
          not: null
        }
      },
      select: {
        publishedAt: true
      }
    })

    // Group posts by date and count them
    const activityMap = new Map<string, number>()

    posts.forEach(post => {
      if (!post.publishedAt) return

      const date = new Date(post.publishedAt)
      date.setHours(0, 0, 0, 0)
      const dateKey = date.toISOString().split('T')[0]

      activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1)
    })

    // Get the first post date
    const firstPost = await prisma.tiktokPost.findFirst({
      where: {
        profileId: profileId,
        publishedAt: {
          not: null
        }
      },
      orderBy: {
        publishedAt: 'asc'
      },
      select: {
        publishedAt: true
      }
    })

    // Convert map to array
    const activityData = Array.from(activityMap.entries()).map(([date, count]) => ({
      date,
      count
    }))

    return NextResponse.json({
      data: activityData,
      firstPostDate: firstPost?.publishedAt?.toISOString().split('T')[0] || null
    })
  } catch (error) {
    console.error('Failed to fetch profile activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile activity' },
      { status: 500 }
    )
  }
}
