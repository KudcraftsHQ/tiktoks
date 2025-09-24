import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

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

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

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

    return NextResponse.json({
      profiles,
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