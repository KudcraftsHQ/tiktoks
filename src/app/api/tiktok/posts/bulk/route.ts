import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { TikTokBulkUpsertService } from '@/lib/tiktok-bulk-upsert-service'

const prisma = new PrismaClient()
const bulkUpsertService = new TikTokBulkUpsertService(prisma)

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

    // Use the bulk upsert service
    const result = await bulkUpsertService.bulkUpsert(profileData, postsData)

    return NextResponse.json(result, { status: 200 })
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