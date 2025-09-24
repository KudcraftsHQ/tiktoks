import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { mediaCacheServiceV2 } from '@/lib/media-cache-service-v2'

const prisma = new PrismaClient()

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Helper function to cache media for a single post
async function cachePostMedia(postData: any) {
  console.log(`🚀 [BulkUpsert] Caching media for post: ${postData.tiktokId}`)

  try {
    const cacheResult = await mediaCacheServiceV2.cacheTikTokPostMedia(
      postData.videoUrl,
      postData.coverUrl,
      postData.musicUrl,
      postData.images,
      postData.authorAvatar
    )

    // Log any caching errors
    if (cacheResult.errors.length > 0) {
      console.warn(`❌ [BulkUpsert] Media caching warnings for post ${postData.tiktokId}:`, cacheResult.errors)
    }

    console.log(`✅ [BulkUpsert] Media cached successfully for post: ${postData.tiktokId}`)

    return {
      cachedVideo: cacheResult.cachedVideoId,
      cachedCover: cacheResult.cachedCoverId,
      cachedMusic: cacheResult.cachedMusicId,
      cachedImages: cacheResult.cachedImages,
      cachedAuthorAvatar: cacheResult.cachedAuthorAvatarId
    }
  } catch (error) {
    console.error(`❌ [BulkUpsert] Failed to cache media for post ${postData.tiktokId}:`, error)
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

    // Cache profile avatar if available (outside transaction)
    let profileAvatarId: string | undefined

    if (profileData.avatar) {
      try {
        console.log(`🚀 [BulkUpsert] Caching profile avatar for: ${profileData.handle}`)
        const avatarCacheAssetId = await mediaCacheServiceV2.cacheAvatar(profileData.avatar)
        if (avatarCacheAssetId) {
          profileAvatarId = avatarCacheAssetId
          console.log(`✅ [BulkUpsert] Profile avatar cached successfully for: ${profileData.handle}`)
        }
      } catch (error) {
        console.error(`❌ [BulkUpsert] Failed to cache profile avatar for ${profileData.handle}:`, error)
      }
    }

    // Cache media for all posts first (outside transaction)
    console.log(`🚀 [BulkUpsert] Starting media caching for ${postsData.length} posts`)
    const postsWithCachedMedia = await Promise.all(
      postsData.map(async (postData) => {
        console.log(`🔄 [BulkUpsert] Caching media for post: ${postData.tiktokId}`)
        const cachedMedia = await cachePostMedia(postData)
        return {
          postData,
          cachedMedia
        }
      })
    )
    console.log(`✅ [BulkUpsert] Media caching completed for all posts`)

    // Process database operations in smaller batches to avoid timeout
    console.log(`🚀 [BulkUpsert] Starting database operations for ${postsWithCachedMedia.length} posts`)

    // First, upsert the profile in a separate transaction
    const profile = await prisma.$transaction(async (tx) => {
      console.log(`🔄 [BulkUpsert] Upserting profile: ${profileData.handle}`)
      return tx.tiktokProfile.upsert({
        where: { handle: profileData.handle },
        create: {
          handle: profileData.handle,
          nickname: profileData.nickname,
          avatarId: profileAvatarId,
          bio: profileData.bio,
          verified: profileData.verified || false,
          followerCount: profileData.followerCount || 0,
          followingCount: profileData.followingCount || 0,
          videoCount: profileData.videoCount || 0,
          likeCount: profileData.likeCount || 0
        },
        update: {
          nickname: profileData.nickname,
          avatarId: profileAvatarId,
          bio: profileData.bio,
          verified: profileData.verified || false,
          followerCount: profileData.followerCount || 0,
          followingCount: profileData.followingCount || 0,
          videoCount: profileData.videoCount || 0,
          likeCount: profileData.likeCount || 0,
          updatedAt: new Date()
        }
      })
    })
    console.log(`✅ [BulkUpsert] Profile upserted successfully: ${profileData.handle}`)

    // Then process posts in smaller batches of 5 to avoid transaction timeout
    const batchSize = 5
    const postBatches = chunkArray(postsWithCachedMedia, batchSize)
    const allPostResults: any[] = []
    let createdCount = 0
    let updatedCount = 0

    console.log(`📦 [BulkUpsert] Processing ${postBatches.length} batches of ${batchSize} posts each`)

    for (let i = 0; i < postBatches.length; i++) {
      const batch = postBatches[i]
      console.log(`🔄 [BulkUpsert] Processing batch ${i + 1}/${postBatches.length}`)

      const batchResults = await prisma.$transaction(async (tx) => {
        return Promise.all(
          batch.map(async ({ postData, cachedMedia }) => {
            console.log(`🔄 [BulkUpsert] Upserting post in DB: ${postData.tiktokId}`)

            // Check if post exists
            const existingPost = await tx.tiktokPost.findUnique({
              where: { tiktokId: postData.tiktokId }
            })

            // Prepare post data with cached media (using CacheAsset ID pattern)
            const postCreateData = {
              tiktokId: postData.tiktokId,
              profileId: profile.id,
              tiktokUrl: postData.tiktokUrl,
              contentType: postData.contentType,
              title: postData.title,
              description: postData.description,
              authorNickname: postData.authorNickname,
              authorHandle: postData.authorHandle,
              authorAvatarId: cachedMedia.cachedAuthorAvatar,
              hashtags: JSON.stringify(postData.hashtags),
              mentions: JSON.stringify(postData.mentions),
              viewCount: BigInt(postData.viewCount),
              likeCount: postData.likeCount,
              shareCount: postData.shareCount,
              commentCount: postData.commentCount,
              saveCount: postData.saveCount,
              duration: postData.duration,
              videoId: cachedMedia.cachedVideo,
              coverId: cachedMedia.cachedCover,
              musicId: cachedMedia.cachedMusic,
              images: JSON.stringify(cachedMedia.cachedImages.length > 0 ? cachedMedia.cachedImages : postData.images),
              publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null
            }

            const postUpdateData = {
              tiktokUrl: postData.tiktokUrl,
              contentType: postData.contentType,
              title: postData.title,
              description: postData.description,
              authorNickname: postData.authorNickname,
              authorHandle: postData.authorHandle,
              authorAvatarId: cachedMedia.cachedAuthorAvatar,
              hashtags: JSON.stringify(postData.hashtags),
              mentions: JSON.stringify(postData.mentions),
              viewCount: BigInt(postData.viewCount),
              likeCount: postData.likeCount,
              shareCount: postData.shareCount,
              commentCount: postData.commentCount,
              saveCount: postData.saveCount,
              duration: postData.duration,
              videoId: cachedMedia.cachedVideo,
              coverId: cachedMedia.cachedCover,
              musicId: cachedMedia.cachedMusic,
              images: JSON.stringify(cachedMedia.cachedImages.length > 0 ? cachedMedia.cachedImages : postData.images),
              publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null,
              updatedAt: new Date()
            }

            const post = await tx.tiktokPost.upsert({
              where: { tiktokId: postData.tiktokId },
              create: postCreateData,
              update: postUpdateData
            })

            if (existingPost) {
              updatedCount++
              console.log(`📝 [BulkUpsert] Updated post: ${postData.tiktokId}`)
            } else {
              createdCount++
              console.log(`➕ [BulkUpsert] Created post: ${postData.tiktokId}`)
            }

            return {
              ...post,
              viewCount: post.viewCount?.toString() || '0'
            }
          })
        )
      })

      allPostResults.push(...batchResults)

      // Small delay between batches to be respectful to the database
      if (postBatches.length > 1) {
        console.log(`⏳ [BulkUpsert] Waiting 500ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const results = {
      profile,
      posts: allPostResults,
      stats: {
        postsCreated: createdCount,
        postsUpdated: updatedCount,
        totalPosts: postsData.length
      }
    }

    console.log(`✅ [BulkUpsert] Completed bulk upsert for profile ${profileData.handle}:`, {
      totalPosts: postsData.length,
      postsCreated: createdCount,
      postsUpdated: updatedCount,
      profileAvatarCached: !!profileAvatarId
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