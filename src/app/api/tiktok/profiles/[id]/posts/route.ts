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
    const includeHistory = searchParams.get('includeHistory') !== 'false' // Default to true

    // Parse sorting from URL
    const sortBy = searchParams.get('sortBy') || 'publishedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const orderBy: any = { [sortBy]: sortOrder }

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
        orderBy,
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

    // Parse all images from all posts and collect all image IDs for bulk fetching
    const parsedPostImages: Array<{ postIndex: number; images: any[] }> = []
    const allImageIds: Array<string | null> = []

    posts.forEach((post, index) => {
      try {
        const parsedImages = typeof post.images === 'string'
          ? JSON.parse(post.images || '[]')
          : Array.isArray(post.images) ? post.images : []

        parsedPostImages.push({ postIndex: index, images: parsedImages })

        // Collect all image IDs for bulk fetching
        parsedImages.forEach((img: any) => {
          allImageIds.push(img.cacheAssetId || null)
        })
      } catch (error) {
        console.warn('Failed to parse images for post:', post.id, error)
        parsedPostImages.push({ postIndex: index, images: [] })
      }
    })

    // Fetch all presigned URLs in bulk (one query for all images across all posts)
    const [presignedCoverUrls, presignedAvatarUrls, allPresignedImageUrls] = await Promise.all([
      cacheAssetService.getUrls(coverIds),
      cacheAssetService.getUrls(avatarIds),
      cacheAssetService.getUrls(allImageIds)
    ])

    // Convert BigInt to string for JSON serialization and add presigned URLs
    let imageUrlIndex = 0
    const responsePosts = posts.map((post, index) => {
      const postImages = parsedPostImages.find(p => p.postIndex === index)
      let images = []

      if (postImages && postImages.images.length > 0) {
        images = postImages.images.map((img: any) => {
          const url = allPresignedImageUrls[imageUrlIndex++]
          return {
            ...img,
            url
          }
        })
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