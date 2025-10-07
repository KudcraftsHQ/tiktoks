import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch the post to verify it exists
    const post = await prisma.tiktokPost.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Fetch historical metrics ordered by date
    const metricsHistory = await prisma.tikTokPostMetricsHistory.findMany({
      where: { postId: id },
      orderBy: { recordedAt: 'asc' },
      select: {
        viewCount: true,
        likeCount: true,
        shareCount: true,
        commentCount: true,
        saveCount: true,
        recordedAt: true
      }
    })

    // If no history exists, return current values as a single data point
    if (metricsHistory.length === 0) {
      const currentMetrics = {
        viewCount: Number(post.viewCount || 0),
        likeCount: post.likeCount || 0,
        shareCount: post.shareCount || 0,
        commentCount: post.commentCount || 0,
        saveCount: post.saveCount || 0,
        recordedAt: post.updatedAt
      }

      return NextResponse.json({
        post: {
          id: post.id,
          tiktokId: post.tiktokId
        },
        metrics: {
          views: [currentMetrics.viewCount],
          likes: [currentMetrics.likeCount],
          shares: [currentMetrics.shareCount],
          comments: [currentMetrics.commentCount],
          saves: [currentMetrics.saveCount],
          dates: [currentMetrics.recordedAt]
        },
        current: currentMetrics
      })
    }

    // Transform the data into arrays for each metric
    const metrics = {
      views: metricsHistory.map(m => Number(m.viewCount || 0)),
      likes: metricsHistory.map(m => m.likeCount || 0),
      shares: metricsHistory.map(m => m.shareCount || 0),
      comments: metricsHistory.map(m => m.commentCount || 0),
      saves: metricsHistory.map(m => m.saveCount || 0),
      dates: metricsHistory.map(m => m.recordedAt)
    }

    // Get the most recent metrics
    const latestMetrics = metricsHistory[metricsHistory.length - 1]
    const current = {
      viewCount: Number(latestMetrics.viewCount || 0),
      likeCount: latestMetrics.likeCount || 0,
      shareCount: latestMetrics.shareCount || 0,
      commentCount: latestMetrics.commentCount || 0,
      saveCount: latestMetrics.saveCount || 0,
      recordedAt: latestMetrics.recordedAt
    }

    return NextResponse.json({
      post: {
        id: post.id,
        tiktokId: post.tiktokId
      },
      metrics,
      current
    })
  } catch (error) {
    console.error('Error fetching post analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
