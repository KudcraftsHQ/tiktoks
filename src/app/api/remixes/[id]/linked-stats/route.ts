import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { parseTikTokUrl } from '@/lib/tiktok-url-parser'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const remixId = resolvedParams.id

    if (!remixId) {
      return NextResponse.json(
        { error: 'Remix ID is required' },
        { status: 400 }
      )
    }

    // Get the remix with posted URL
    const remix = await prisma.remixPost.findUnique({
      where: { id: remixId },
      select: {
        id: true,
        postedUrl: true,
        postedAt: true
      }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    if (!remix.postedUrl) {
      return NextResponse.json({
        linkedPost: null,
        metricsHistory: []
      })
    }

    // Parse the posted URL
    const parsedUrl = parseTikTokUrl(remix.postedUrl)

    // Try to find matching post
    const whereClause: any = {
      OR: [
        { tiktokUrl: parsedUrl.normalizedUrl },
        { tiktokUrl: remix.postedUrl }
      ]
    }

    if (parsedUrl.videoId) {
      whereClause.OR.push({ tiktokId: parsedUrl.videoId })
    }

    const linkedPost = await prisma.tiktokPost.findFirst({
      where: whereClause,
      include: {
        profile: {
          select: {
            id: true,
            handle: true,
            nickname: true,
            isOwnProfile: true
          }
        },
        metricsHistory: {
          orderBy: { recordedAt: 'asc' },
          select: {
            viewCount: true,
            likeCount: true,
            shareCount: true,
            commentCount: true,
            saveCount: true,
            recordedAt: true
          }
        }
      }
    })

    if (!linkedPost) {
      return NextResponse.json({
        linkedPost: null,
        metricsHistory: []
      })
    }

    // Only return stats if it's an own profile
    if (!linkedPost.profile.isOwnProfile) {
      return NextResponse.json({
        linkedPost: {
          id: linkedPost.id,
          tiktokUrl: linkedPost.tiktokUrl,
          profile: linkedPost.profile,
          isOwnProfile: false
        },
        metricsHistory: []
      })
    }

    // Return full stats
    const response = {
      linkedPost: {
        id: linkedPost.id,
        tiktokUrl: linkedPost.tiktokUrl,
        viewCount: linkedPost.viewCount?.toString() || '0',
        likeCount: linkedPost.likeCount || 0,
        shareCount: linkedPost.shareCount || 0,
        commentCount: linkedPost.commentCount || 0,
        saveCount: linkedPost.saveCount || 0,
        publishedAt: linkedPost.publishedAt,
        profile: linkedPost.profile,
        isOwnProfile: true
      },
      metricsHistory: linkedPost.metricsHistory.map(m => ({
        viewCount: m.viewCount?.toString() || '0',
        likeCount: m.likeCount || 0,
        shareCount: m.shareCount || 0,
        commentCount: m.commentCount || 0,
        saveCount: m.saveCount || 0,
        recordedAt: m.recordedAt
      }))
    }

    return NextResponse.json(response)

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to get linked stats for remix ${resolvedParams.id}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get linked post stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
