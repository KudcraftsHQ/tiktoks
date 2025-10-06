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

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

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

    const [profiles, total] = await Promise.all([
      prisma.tiktokProfile.findMany({
        where,
        include: {
          _count: {
            select: { posts: true }
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

    // Resolve avatar URLs for all profiles
    console.log(`🔗 [API] Resolving avatar URLs for ${profiles.length} profiles`)
    const profilesWithAvatars = await Promise.all(
      profiles.map(async (profile) => {
        const avatarUrl = await cacheAssetService.getUrl(profile.avatarId)
        return {
          ...profile,
          avatar: avatarUrl,
          // Serialize BigInt fields to strings for JSON
          totalViews: profile.totalViews?.toString() || '0',
          totalLikes: profile.totalLikes?.toString() || '0',
          totalShares: profile.totalShares?.toString() || '0',
          totalComments: profile.totalComments?.toString() || '0',
          totalSaves: profile.totalSaves?.toString() || '0'
        }
      })
    )
    console.log(`✅ [API] Resolved avatar URLs for all profiles`)

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