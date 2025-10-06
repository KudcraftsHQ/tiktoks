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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const contentType = searchParams.get('contentType')
    const search = searchParams.get('search') || ''
    const includeHistory = searchParams.get('includeHistory') === 'true'

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { profileId: id }

    if (contentType && ['video', 'photo'].includes(contentType)) {
      where.contentType = contentType
    }

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive' as const
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive' as const
          }
        }
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.tiktokPost.findMany({
        where,
        include: includeHistory ? {
          metricsHistory: {
            orderBy: {
              recordedAt: 'desc'
            },
            take: 30 // Last 30 history entries
          }
        } : undefined,
        orderBy: {
          publishedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.tiktokPost.count({ where })
    ])

    const hasMore = skip + limit < total

    // Generate presigned URLs for cover images and author avatars
    console.log(`🔗 [API] Generating presigned URLs for ${posts.length} posts`)

    const coverIds = posts.map(post => post.coverId)
    const avatarIds = posts.map(post => post.authorAvatarId)

    console.log(`🖼️ [API] Cover IDs:`, coverIds.filter(Boolean))
    console.log(`👤 [API] Avatar IDs:`, avatarIds.filter(Boolean))

    const [presignedCoverUrls, presignedAvatarUrls] = await Promise.all([
      cacheAssetService.getUrls(coverIds),
      cacheAssetService.getUrls(avatarIds)
    ])

    // Convert BigInt to string for JSON serialization and add presigned URLs
    const responsePosts = await Promise.all(
      posts.map(async (post, index) => {
        // Parse images JSON and generate presigned URLs for each image
        let images = []
        try {
          const parsedImages = typeof post.images === 'string'
            ? JSON.parse(post.images || '[]')
            : Array.isArray(post.images) ? post.images : []
          if (parsedImages.length > 0) {
            const imageIds = parsedImages.map((img: any) => img.cacheAssetId)
            const presignedImageUrls = await cacheAssetService.getUrls(imageIds)

            images = parsedImages.map((img: any, imgIndex: number) => ({
              ...img,
              url: presignedImageUrls[imgIndex]
            }))
          } else {
            images = parsedImages
          }
        } catch (error) {
          console.warn('Failed to parse images for post:', post.id, error)
          images = typeof post.images === 'string'
            ? JSON.parse(post.images || '[]')
            : Array.isArray(post.images) ? post.images : []
        }

        return {
          ...post,
          viewCount: post.viewCount?.toString() || '0',
          coverUrl: presignedCoverUrls[index],
          authorAvatar: presignedAvatarUrls[index],
          images: images,
          metricsHistory: includeHistory && (post as any).metricsHistory
            ? (post as any).metricsHistory.map((h: any) => ({
                ...h,
                viewCount: h.viewCount?.toString() || '0'
              }))
            : undefined
        }
      })
    )

    console.log(`✅ [API] Posts processed with presigned URLs:`, {
      originalCount: posts.length,
      processedCount: responsePosts.length,
      coverUrlsGenerated: presignedCoverUrls.filter(Boolean).length,
      avatarUrlsGenerated: presignedAvatarUrls.filter(Boolean).length
    })

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