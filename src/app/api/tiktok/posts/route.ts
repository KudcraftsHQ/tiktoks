import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { mediaCacheServiceV2 } from '@/lib/media-cache-service-v2'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

// Helper function to cache TikTok post media
async function cacheTikTokPostMedia(validatedData: any) {
  const {
    videoUrl,
    coverUrl,
    musicUrl,
    images,
    authorAvatar
  } = validatedData

  try {
    const cacheResult = await mediaCacheServiceV2.cacheTikTokPostMedia(
      videoUrl,
      coverUrl,
      musicUrl,
      images,
      authorAvatar
    )

    // Log any caching errors
    if (cacheResult.errors.length > 0) {
      console.warn('TikTok post media caching warnings:', cacheResult.errors)
    }

    return {
      cachedVideo: cacheResult.cachedVideoId,
      cachedCover: cacheResult.cachedCoverId,
      cachedMusic: cacheResult.cachedMusicId,
      cachedImages: cacheResult.cachedImages,
      cachedAuthorAvatar: cacheResult.cachedAuthorAvatarId
    }
  } catch (error) {
    console.error('Failed to cache TikTok post media:', error)
    // Return null values to fall back to original URLs
    return {
      cachedVideo: null,
      cachedCover: null,
      cachedMusic: null,
      cachedImages: [],
      cachedAuthorAvatar: null
    }
  }
}

const SavePostSchema = z.object({
  tiktokId: z.string(),
  tiktokUrl: z.string().url(),
  contentType: z.enum(['video', 'photo']),
  title: z.string().optional(),
  description: z.string().optional(),
  authorNickname: z.string().optional(),
  authorHandle: z.string(),
  authorAvatar: z.string().optional(),
  hashtags: z.array(z.object({
    text: z.string(),
    url: z.string()
  })).default([]),
  mentions: z.array(z.string()).default([]),
  viewCount: z.number().default(0),
  likeCount: z.number().default(0),
  shareCount: z.number().default(0),
  commentCount: z.number().default(0),
  saveCount: z.number().default(0),
  duration: z.number().optional(),
  videoUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  musicUrl: z.string().optional(),
  images: z.array(z.object({
    url: z.string(),
    width: z.number(),
    height: z.number()
  })).default([]),
  publishedAt: z.string().datetime().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = SavePostSchema.parse(body)

    // Check if post already exists
    const existingPost = await prisma.tiktokPost.findUnique({
      where: { tiktokId: validatedData.tiktokId }
    })

    if (existingPost) {
      return NextResponse.json(existingPost)
    }

    // Cache media to R2
    const cachedMedia = await cacheTikTokPostMedia(validatedData)

    // Find or create the profile (with cached avatar if available)
    let profile = await prisma.tiktokProfile.findUnique({
      where: { handle: validatedData.authorHandle }
    })

    if (!profile) {
      profile = await prisma.tiktokProfile.create({
        data: {
          handle: validatedData.authorHandle,
          nickname: validatedData.authorNickname,
          avatarId: cachedMedia.cachedAuthorAvatar
        }
      })
    } else if (cachedMedia.cachedAuthorAvatar && !profile.avatarId) {
      // Update existing profile with cached avatar
      profile = await prisma.tiktokProfile.update({
        where: { id: profile.id },
        data: {
          avatarId: cachedMedia.cachedAuthorAvatar
        }
      })
    }

    // Create the post with cached media asset IDs
    const post = await prisma.tiktokPost.create({
      data: {
        tiktokId: validatedData.tiktokId,
        profileId: profile.id,
        tiktokUrl: validatedData.tiktokUrl,
        contentType: validatedData.contentType,
        title: validatedData.title,
        description: validatedData.description,
        authorNickname: validatedData.authorNickname,
        authorHandle: validatedData.authorHandle,
        authorAvatarId: cachedMedia.cachedAuthorAvatar,
        hashtags: JSON.stringify(validatedData.hashtags),
        mentions: JSON.stringify(validatedData.mentions),
        viewCount: BigInt(validatedData.viewCount),
        likeCount: validatedData.likeCount,
        shareCount: validatedData.shareCount,
        commentCount: validatedData.commentCount,
        saveCount: validatedData.saveCount,
        duration: validatedData.duration,
        videoId: cachedMedia.cachedVideo,
        coverId: cachedMedia.cachedCover,
        musicId: cachedMedia.cachedMusic,
        images: JSON.stringify(cachedMedia.cachedImages.length > 0 ? cachedMedia.cachedImages : validatedData.images),
        publishedAt: validatedData.publishedAt ? new Date(validatedData.publishedAt) : null
      }
    })

    // Convert BigInt to string for JSON serialization
    const responsePost = {
      ...post,
      viewCount: post.viewCount?.toString() || '0'
    }

    return NextResponse.json(responsePost, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to save post:', error)
    return NextResponse.json(
      { error: 'Failed to save post' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const contentType = searchParams.get('contentType')
    const authorHandle = searchParams.get('authorHandle')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (contentType && ['video', 'photo'].includes(contentType)) {
      where.contentType = contentType
    }

    if (authorHandle) {
      where.authorHandle = authorHandle
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
        },
        {
          authorNickname: {
            contains: search,
            mode: 'insensitive' as const
          }
        },
        {
          authorHandle: {
            contains: search,
            mode: 'insensitive' as const
          }
        }
      ]
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

    // Generate presigned URLs for media
    console.log(`🔗 [API] Generating presigned URLs for ${posts.length} posts`)

    const videoIds = posts.map(post => post.videoId)
    const coverIds = posts.map(post => post.coverId)
    const musicIds = posts.map(post => post.musicId)
    const avatarIds = posts.map(post => post.authorAvatarId)

    const [presignedVideoUrls, presignedCoverUrls, presignedMusicUrls, presignedAvatarUrls] = await Promise.all([
      cacheAssetService.getUrls(videoIds),
      cacheAssetService.getUrls(coverIds),
      cacheAssetService.getUrls(musicIds),
      cacheAssetService.getUrls(avatarIds)
    ])

    // Convert BigInt to string for JSON serialization and add presigned URLs
    const responsePosts = await Promise.all(
      posts.map(async (post, index) => {
        // Parse images JSON and generate presigned URLs for each image
        let images = []
        try {
          const parsedImages = JSON.parse(post.images || '[]')
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
          images = JSON.parse(post.images || '[]')
        }

        return {
          ...post,
          viewCount: post.viewCount?.toString() || '0',
          videoUrl: presignedVideoUrls[index],
          coverUrl: presignedCoverUrls[index],
          musicUrl: presignedMusicUrls[index],
          authorAvatar: presignedAvatarUrls[index],
          images: images
        }
      })
    )

    return NextResponse.json({
      posts: responsePosts,
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}