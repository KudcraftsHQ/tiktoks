import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const postId = resolvedParams.id

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    // Get the post with profile data
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId },
      include: {
        profile: {
          select: {
            id: true,
            handle: true,
            nickname: true,
            verified: true,
            bio: true
          }
        }
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Get resolved URLs for media assets
    let avatarUrl = null
    if (post.authorAvatarId) {
      avatarUrl = await cacheAssetService.getUrl(post.authorAvatarId)
    }

    let coverUrl = null
    if (post.coverId) {
      coverUrl = await cacheAssetService.getUrl(post.coverId)
    }

    let videoUrl = null
    if (post.videoId) {
      videoUrl = await cacheAssetService.getUrl(post.videoId)
    }

    let musicUrl = null
    if (post.musicId) {
      musicUrl = await cacheAssetService.getUrl(post.musicId)
    }

    // Process images with resolved URLs
    const images = typeof post.images === 'string'
      ? JSON.parse(post.images) as Array<{ cacheAssetId: string; width: number; height: number }>
      : (Array.isArray(post.images) ? post.images as Array<{ cacheAssetId: string; width: number; height: number }> : [])
    let imageUrls: string[] = []
    if (images.length > 0) {
      const cacheAssetIds = images.map(img => img.cacheAssetId)
      imageUrls = await cacheAssetService.getUrls(cacheAssetIds)
    }

    // Parse hashtags and mentions from JSON strings
    let hashtags = []
    let mentions = []

    try {
      hashtags = typeof post.hashtags === 'string'
        ? JSON.parse(post.hashtags || '[]')
        : (Array.isArray(post.hashtags) ? post.hashtags : [])
    } catch (error) {
      console.warn('Failed to parse hashtags for post:', post.id, error)
      hashtags = []
    }

    try {
      mentions = typeof post.mentions === 'string'
        ? JSON.parse(post.mentions || '[]')
        : (Array.isArray(post.mentions) ? post.mentions : [])
    } catch (error) {
      console.warn('Failed to parse mentions for post:', post.id, error)
      mentions = []
    }

    // Get post category if available
    let postCategory = null
    if (post.postCategoryId) {
      const category = await prisma.postCategory.findUnique({
        where: { id: post.postCategoryId }
      })
      if (category) {
        postCategory = {
          id: category.id,
          name: category.name
        }
      }
    }

    // Format the response
    const response = {
      id: post.id,
      tiktokId: post.tiktokId,
      tiktokUrl: post.tiktokUrl,
      contentType: post.contentType,
      title: post.title,
      description: post.description,

      // Author info
      authorNickname: post.authorNickname,
      authorHandle: post.authorHandle,
      authorAvatarUrl: avatarUrl,

      // Media
      videoUrl,
      coverUrl,
      musicUrl,
      images: images.map((img, index) => ({
        ...img,
        url: imageUrls[index] || null
      })),

      // OCR data
      ocrTexts: post.ocrTexts,
      ocrStatus: post.ocrStatus,
      ocrProcessedAt: post.ocrProcessedAt,
      imageDescriptions: post.imageDescriptions,
      slideClassifications: post.slideClassifications,
      postCategory,
      categoryConfidence: post.categoryConfidence,

      // Hashtags and mentions
      hashtags: hashtags,
      mentions: mentions,

      // Engagement metrics
      viewCount: post.viewCount ? post.viewCount.toString() : null,
      likeCount: post.likeCount,
      shareCount: post.shareCount,
      commentCount: post.commentCount,
      saveCount: post.saveCount,

      // Video specific
      duration: post.duration,

      // Timestamps
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,

      // Profile info
      profile: post.profile
    }

    return NextResponse.json(response)

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to get post ${resolvedParams?.id || 'unknown'}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to get post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const postId = resolvedParams.id

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { description } = body

    if (description === undefined) {
      return NextResponse.json(
        { error: 'Description is required in request body' },
        { status: 400 }
      )
    }

    // Update the post description
    const updatedPost = await prisma.tiktokPost.update({
      where: { id: postId },
      data: {
        description: description
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Post description updated successfully',
      post: {
        id: updatedPost.id,
        description: updatedPost.description
      }
    })

  } catch (error) {
    const resolvedParams = await params
    console.error(`❌ [API] Failed to update post ${resolvedParams?.id || 'unknown'}:`, error)

    return NextResponse.json(
      {
        error: 'Failed to update post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}