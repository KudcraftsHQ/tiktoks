import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'
import { startOfDay } from 'date-fns'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search') || ''
    const verified = searchParams.get('verified')
    const minFollowers = searchParams.get('minFollowers')
    const maxFollowers = searchParams.get('maxFollowers')
    const groupId = searchParams.get('groupId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const skip = (page - 1) * limit

    // Build where clause for profiles (NOT filtered by date)
    const where: any = {}

    // Filter by group
    if (groupId) {
      if (groupId === 'ungrouped') {
        where.profileGroupId = null
      } else {
        where.profileGroupId = groupId
      }
    }

    if (search) {
      where.OR = [
        {
          handle: {
            contains: search,
            mode: 'insensitive' as const
          }
        },
        {
          nickname: {
            contains: search,
            mode: 'insensitive' as const
          }
        },
        {
          bio: {
            contains: search,
            mode: 'insensitive' as const
          }
        }
      ]
    }

    if (verified === 'true') {
      where.verified = true
    } else if (verified === 'false') {
      where.verified = false
    }

    if (minFollowers) {
      where.followerCount = {
        ...where.followerCount,
        gte: parseInt(minFollowers)
      }
    }

    if (maxFollowers) {
      where.followerCount = {
        ...where.followerCount,
        lte: parseInt(maxFollowers)
      }
    }

    // Parse date range for metrics gain calculation
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null
    const toDate = dateTo ? startOfDay(new Date(dateTo)) : null

    const [profiles, total] = await Promise.all([
      prisma.tiktokProfile.findMany({
        where,
        include: {
          _count: {
            select: { posts: true }
          },
          profileGroup: {
            select: {
              id: true,
              name: true
            }
          },
          // Fetch ALL posts (no date filter) - we calculate gains from metrics history
          posts: {
            select: {
              id: true,
              viewCount: true,
              likeCount: true,
              shareCount: true,
              commentCount: true,
              saveCount: true
            }
          }
        },
        orderBy: {
          followerCount: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.tiktokProfile.count({ where })
    ])

    const hasMore = skip + limit < total

    // Get all post IDs for metrics history lookup
    const allPostIds = profiles.flatMap(p => p.posts.map(post => post.id))

    // Fetch metrics history for calculating gains if date range is specified
    let metricsGainsByPost = new Map<string, {
      viewsGain: bigint
      likesGain: number
      commentsGain: number
      sharesGain: number
      savesGain: number
    }>()

    if (fromDate && toDate && allPostIds.length > 0) {
      // Get metrics history within date range for all posts
      const metricsHistory = await prisma.tikTokPostMetricsHistory.findMany({
        where: {
          postId: { in: allPostIds },
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
          likeCount: true,
          commentCount: true,
          shareCount: true,
          saveCount: true,
          recordedAt: true
        }
      })

      // Group metrics by post, keeping first and last recorded values
      const postMetricsRange = new Map<string, {
        first: typeof metricsHistory[0] | null
        last: typeof metricsHistory[0] | null
      }>()

      metricsHistory.forEach(metric => {
        const existing = postMetricsRange.get(metric.postId)
        if (!existing) {
          postMetricsRange.set(metric.postId, { first: metric, last: metric })
        } else {
          // Update last (metrics are ordered by recordedAt asc)
          existing.last = metric
        }
      })

      // Calculate gains for each post
      postMetricsRange.forEach((range, postId) => {
        if (range.first && range.last) {
          const viewsGain = (range.last.viewCount || BigInt(0)) - (range.first.viewCount || BigInt(0))
          const likesGain = (range.last.likeCount || 0) - (range.first.likeCount || 0)
          const commentsGain = (range.last.commentCount || 0) - (range.first.commentCount || 0)
          const sharesGain = (range.last.shareCount || 0) - (range.first.shareCount || 0)
          const savesGain = (range.last.saveCount || 0) - (range.first.saveCount || 0)

          metricsGainsByPost.set(postId, {
            viewsGain: viewsGain > BigInt(0) ? viewsGain : BigInt(0),
            likesGain: Math.max(0, likesGain),
            commentsGain: Math.max(0, commentsGain),
            sharesGain: Math.max(0, sharesGain),
            savesGain: Math.max(0, savesGain)
          })
        }
      })
    }

    // Resolve avatar URLs and calculate date-filtered metrics for all profiles
    console.log(`🔗 [API] Resolving avatar URLs for ${profiles.length} profiles`)
    const profilesWithAvatars = await Promise.all(
      profiles.map(async (profile) => {
        const avatarUrl = await cacheAssetService.getUrl(profile.avatarId)

        // Calculate metrics gains from history (or use post totals if no date range)
        let totalPosts = profile.posts.length
        let totalViews = BigInt(0)
        let totalLikes = 0
        let totalComments = 0
        let totalShares = 0
        let totalSaves = 0

        if (fromDate && toDate) {
          // Use metrics gains from history
          profile.posts.forEach(post => {
            const gains = metricsGainsByPost.get(post.id)
            if (gains) {
              totalViews += gains.viewsGain
              totalLikes += gains.likesGain
              totalComments += gains.commentsGain
              totalShares += gains.sharesGain
              totalSaves += gains.savesGain
            }
          })
        } else {
          // No date range - use current totals from posts
          profile.posts.forEach(post => {
            totalViews += post.viewCount || BigInt(0)
            totalLikes += post.likeCount || 0
            totalComments += post.commentCount || 0
            totalShares += post.shareCount || 0
            totalSaves += post.saveCount || 0
          })
        }

        return {
          ...profile,
          avatar: avatarUrl,
          // Use metrics gains within period
          totalPosts,
          totalViews: totalViews.toString(),
          totalLikes: totalLikes.toString(),
          totalShares: totalShares.toString(),
          totalComments: totalComments.toString(),
          totalSaves: totalSaves.toString(),
          // Remove posts array from response
          posts: undefined
        }
      })
    )
    console.log(`✅ [API] Resolved avatar URLs and calculated metrics gains for all profiles`)

    return NextResponse.json({
      profiles: profilesWithAvatars,
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    )
  }
}