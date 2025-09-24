import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const BulkUpsertSchema = z.object({
  profile: z.object({
    handle: z.string(),
    nickname: z.string().optional(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
    verified: z.boolean().optional(),
    followerCount: z.number().optional(),
    followingCount: z.number().optional(),
    videoCount: z.number().optional(),
    likeCount: z.number().optional()
  }),
  posts: z.array(z.object({
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
  }))
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile: profileData, posts: postsData } = BulkUpsertSchema.parse(body)

    const results = await prisma.$transaction(async (tx) => {
      // Upsert profile
      const profile = await tx.tiktokProfile.upsert({
        where: { handle: profileData.handle },
        create: {
          handle: profileData.handle,
          nickname: profileData.nickname,
          avatar: profileData.avatar,
          bio: profileData.bio,
          verified: profileData.verified || false,
          followerCount: profileData.followerCount || 0,
          followingCount: profileData.followingCount || 0,
          videoCount: profileData.videoCount || 0,
          likeCount: profileData.likeCount || 0
        },
        update: {
          nickname: profileData.nickname,
          avatar: profileData.avatar,
          bio: profileData.bio,
          verified: profileData.verified || false,
          followerCount: profileData.followerCount || 0,
          followingCount: profileData.followingCount || 0,
          videoCount: profileData.videoCount || 0,
          likeCount: profileData.likeCount || 0,
          updatedAt: new Date()
        }
      })

      // Track upsert statistics
      let createdCount = 0
      let updatedCount = 0

      // Bulk upsert posts
      const postResults = await Promise.all(
        postsData.map(async (postData) => {
          // Check if post exists
          const existingPost = await tx.tiktokPost.findUnique({
            where: { tiktokId: postData.tiktokId }
          })

          const post = await tx.tiktokPost.upsert({
            where: { tiktokId: postData.tiktokId },
            create: {
              tiktokId: postData.tiktokId,
              profileId: profile.id,
              tiktokUrl: postData.tiktokUrl,
              contentType: postData.contentType,
              title: postData.title,
              description: postData.description,
              authorNickname: postData.authorNickname,
              authorHandle: postData.authorHandle,
              authorAvatar: postData.authorAvatar,
              hashtags: JSON.stringify(postData.hashtags),
              mentions: JSON.stringify(postData.mentions),
              viewCount: BigInt(postData.viewCount),
              likeCount: postData.likeCount,
              shareCount: postData.shareCount,
              commentCount: postData.commentCount,
              saveCount: postData.saveCount,
              duration: postData.duration,
              videoUrl: postData.videoUrl,
              coverUrl: postData.coverUrl,
              musicUrl: postData.musicUrl,
              images: JSON.stringify(postData.images),
              publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null
            },
            update: {
              tiktokUrl: postData.tiktokUrl,
              contentType: postData.contentType,
              title: postData.title,
              description: postData.description,
              authorNickname: postData.authorNickname,
              authorHandle: postData.authorHandle,
              authorAvatar: postData.authorAvatar,
              hashtags: JSON.stringify(postData.hashtags),
              mentions: JSON.stringify(postData.mentions),
              viewCount: BigInt(postData.viewCount),
              likeCount: postData.likeCount,
              shareCount: postData.shareCount,
              commentCount: postData.commentCount,
              saveCount: postData.saveCount,
              duration: postData.duration,
              videoUrl: postData.videoUrl,
              coverUrl: postData.coverUrl,
              musicUrl: postData.musicUrl,
              images: JSON.stringify(postData.images),
              publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null,
              updatedAt: new Date()
            }
          })

          if (existingPost) {
            updatedCount++
          } else {
            createdCount++
          }

          return {
            ...post,
            viewCount: post.viewCount?.toString() || '0'
          }
        })
      )

      return {
        profile,
        posts: postResults,
        stats: {
          postsCreated: createdCount,
          postsUpdated: updatedCount,
          totalPosts: postsData.length
        }
      }
    })

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to bulk upsert posts:', error)
    return NextResponse.json(
      { error: 'Failed to bulk upsert posts' },
      { status: 500 }
    )
  }
}