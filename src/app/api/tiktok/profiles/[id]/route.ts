import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const profile = await prisma.tiktokProfile.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Generate presigned URL for avatar
    console.log(`🔗 [API] Generating presigned URL for profile ${profile.id} avatar`)
    const avatarUrl = await cacheAssetService.getUrl(profile.avatarId)
    console.log(`✅ [API] Avatar URL resolved:`, {
      avatarId: profile.avatarId,
      resolvedUrl: avatarUrl
    })

    const profileWithPresignedAvatar = {
      ...profile,
      avatar: avatarUrl
    }

    return NextResponse.json(profileWithPresignedAvatar)
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function GET_POSTS(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const contentType = searchParams.get('contentType')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { profileId: params.id }

    if (contentType && ['video', 'photo'].includes(contentType)) {
      where.contentType = contentType
    }

    const [posts, total] = await Promise.all([
      prisma.tiktokPost.findMany({
        where,
        orderBy: {
          publishedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.tiktokPost.count({ where })
    ])

    const hasMore = skip + limit < total

    // Convert BigInt to string for JSON serialization
    const responsePosts = posts.map(post => ({
      ...post,
      viewCount: post.viewCount?.toString() || '0'
    }))

    return NextResponse.json({
      posts: responsePosts,
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch profile posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile posts' },
      { status: 500 }
    )
  }
}