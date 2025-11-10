import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

const batchDetailsSchema = z.object({
  postIds: z.array(z.string()).min(1, 'At least one post ID is required'),
})

interface PostImage {
  cacheAssetId: string
  width: number
  height: number
  url?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postIds } = batchDetailsSchema.parse(body)

    // Fetch all posts with their details
    const posts = await prisma.tiktokPost.findMany({
      where: {
        id: {
          in: postIds,
        },
      },
      include: {
        profile: {
          select: {
            handle: true,
            nickname: true,
          },
        },
        postCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Resolve asset URLs for each post
    const postsWithUrls = await Promise.all(
      posts.map(async (post) => {
        // Parse images JSON
        const images = typeof post.images === 'string'
          ? JSON.parse(post.images) as PostImage[]
          : (post.images as unknown) as PostImage[]

        // Get first image URL for thumbnail
        let thumbnailUrl: string | null = null
        if (images && images.length > 0) {
          thumbnailUrl = await cacheAssetService.getUrl(images[0].cacheAssetId)
        } else if (post.coverId) {
          thumbnailUrl = await cacheAssetService.getUrl(post.coverId)
        }

        // Parse OCR texts
        const ocrTexts = typeof post.ocrTexts === 'string'
          ? JSON.parse(post.ocrTexts)
          : post.ocrTexts

        // Parse image descriptions
        const imageDescriptions = typeof post.imageDescriptions === 'string'
          ? JSON.parse(post.imageDescriptions)
          : post.imageDescriptions

        // Parse slide classifications
        const slideClassifications = typeof post.slideClassifications === 'string'
          ? JSON.parse(post.slideClassifications)
          : post.slideClassifications

        return {
          id: post.id,
          tiktokId: post.tiktokId,
          tiktokUrl: post.tiktokUrl,
          contentType: post.contentType,
          description: post.description,
          thumbnailUrl,
          authorHandle: post.profile.handle,
          authorNickname: post.profile.nickname,
          category: post.postCategory,
          // Engagement metrics
          viewCount: post.viewCount?.toString() || '0',
          likeCount: post.likeCount || 0,
          commentCount: post.commentCount || 0,
          shareCount: post.shareCount || 0,
          // OCR and classification data
          ocrTexts,
          imageDescriptions,
          slideClassifications,
          images,
          publishedAt: post.publishedAt?.toISOString(),
        }
      })
    )

    return NextResponse.json({
      posts: postsWithUrls,
      total: postsWithUrls.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to fetch batch post details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post details' },
      { status: 500 }
    )
  }
}
