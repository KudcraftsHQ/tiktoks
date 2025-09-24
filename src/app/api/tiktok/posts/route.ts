import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

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

    // Find or create the profile
    let profile = await prisma.tiktokProfile.findUnique({
      where: { handle: validatedData.authorHandle }
    })

    if (!profile) {
      profile = await prisma.tiktokProfile.create({
        data: {
          handle: validatedData.authorHandle,
          nickname: validatedData.authorNickname,
          avatar: validatedData.authorAvatar
        }
      })
    }

    // Create the post
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
        authorAvatar: validatedData.authorAvatar,
        hashtags: JSON.stringify(validatedData.hashtags),
        mentions: JSON.stringify(validatedData.mentions),
        viewCount: BigInt(validatedData.viewCount),
        likeCount: validatedData.likeCount,
        shareCount: validatedData.shareCount,
        commentCount: validatedData.commentCount,
        saveCount: validatedData.saveCount,
        duration: validatedData.duration,
        videoUrl: validatedData.videoUrl,
        coverUrl: validatedData.coverUrl,
        musicUrl: validatedData.musicUrl,
        images: JSON.stringify(validatedData.images),
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
    console.error('Failed to fetch posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}