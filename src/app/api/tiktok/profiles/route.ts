import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

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
    const isOwnProfile = searchParams.get('isOwnProfile')
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

    // Filter by own profile flag
    if (isOwnProfile === 'true') {
      where.isOwnProfile = true
    } else if (isOwnProfile === 'false') {
      where.isOwnProfile = false
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

    // Build where clause for posts (filtered by date)
    const postWhere: any = {}
    if (dateFrom || dateTo) {
      postWhere.publishedAt = {}
      if (dateFrom) {
        postWhere.publishedAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        postWhere.publishedAt.lte = new Date(dateTo)
      }
    }

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
          posts: {
            where: postWhere,
            select: {
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

    // Resolve avatar URLs and calculate date-filtered metrics for all profiles
    console.log(`🔗 [API] Resolving avatar URLs for ${profiles.length} profiles`)
    const profilesWithAvatars = await Promise.all(
      profiles.map(async (profile) => {
        const avatarUrl = await cacheAssetService.getUrl(profile.avatarId)

        // Calculate metrics from date-filtered posts
        let totalPosts = profile.posts.length
        let totalViews = BigInt(0)
        let totalLikes = 0
        let totalComments = 0
        let totalShares = 0
        let totalSaves = 0

        profile.posts.forEach(post => {
          totalViews += post.viewCount || BigInt(0)
          totalLikes += post.likeCount || 0
          totalComments += post.commentCount || 0
          totalShares += post.shareCount || 0
          totalSaves += post.saveCount || 0
        })

        return {
          ...profile,
          avatar: avatarUrl,
          // Use date-filtered metrics instead of profile aggregates
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
    console.log(`✅ [API] Resolved avatar URLs and calculated metrics for all profiles`)

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