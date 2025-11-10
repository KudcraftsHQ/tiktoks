/**
 * TikTok Bulk Upsert Service
 *
 * Reusable service for bulk upserting TikTok profiles and posts
 * Used by both API routes and background workers
 */

import { PrismaClient, Prisma } from '@/generated/prisma'
import { mediaCacheServiceV2 } from './media-cache-service-v2'

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

/**
 * Sanitize a string to remove problematic characters and escape sequences
 */
function sanitizeString(str: string | null | undefined): string | null | undefined {
  if (!str || typeof str !== 'string') return str

  return str
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove invalid hex escape sequences (e.g., \x followed by non-hex or incomplete)
    .replace(/\\x(?![0-9A-Fa-f]{2})/g, '')
    // Remove lone backslashes that aren't part of valid escape sequences
    .replace(/\\(?!["\\/bfnrtu])/g, '')
    // Remove any remaining problematic Unicode sequences
    .replace(/[\uD800-\uDFFF]/g, '')
}

/**
 * Safely stringify data with proper Unicode handling
 */
function safeStringify(data: any): string {
  try {
    // Use replacer to handle potentially problematic characters
    return JSON.stringify(data, (key, value) => {
      if (typeof value === 'string') {
        return sanitizeString(value)
      }
      return value
    })
  } catch (error) {
    console.error('Error stringifying data:', error)
    // Fallback: return empty array/object
    return Array.isArray(data) ? '[]' : '{}'
  }
}

export interface ProfileData {
  handle: string
  nickname?: string
  avatar?: string
  bio?: string
  verified?: boolean
  followerCount?: number
  followingCount?: number
  videoCount?: number
  likeCount?: number
}

export interface PostData {
  tiktokId: string
  tiktokUrl: string
  contentType: 'video' | 'photo'
  title?: string
  description?: string
  authorNickname?: string
  authorHandle: string
  authorAvatar?: string
  hashtags: Array<{ text: string; url: string }>
  mentions: string[]
  viewCount: number
  likeCount: number
  shareCount: number
  commentCount: number
  saveCount: number
  duration?: number
  videoUrl?: string
  coverUrl?: string
  musicUrl?: string
  images: Array<{ url: string; width: number; height: number; cacheAssetId?: string }>
  publishedAt?: string | Date
}

export interface BulkUpsertResult {
  stats: {
    postsCreated: number
    postsUpdated: number
    totalPosts: number
  }
  profileId: string
}

// Helper function to cache media for a single post
async function cachePostMedia(postData: PostData, forceRecache = false) {
  console.log(`🚀 [BulkUpsertService] Caching media for post: ${postData.tiktokId}`, { forceRecache })

  try {
    const cacheResult = await mediaCacheServiceV2.cacheTikTokPostMedia(
      postData.videoUrl,
      postData.coverUrl,
      postData.musicUrl,
      postData.images,
      postData.authorAvatar,
      forceRecache
    )

    // Log any caching errors
    if (cacheResult.errors.length > 0) {
      console.warn(`❌ [BulkUpsertService] Media caching warnings for post ${postData.tiktokId}:`, cacheResult.errors)
    }

    console.log(`✅ [BulkUpsertService] Media cached successfully for post: ${postData.tiktokId}`)

    return {
      cachedVideo: cacheResult.cachedVideoId,
      cachedCover: cacheResult.cachedCoverId,
      cachedMusic: cacheResult.cachedMusicId,
      cachedImages: cacheResult.cachedImages,
      cachedAuthorAvatar: cacheResult.cachedAuthorAvatarId
    }
  } catch (error) {
    console.error(`❌ [BulkUpsertService] Failed to cache media for post ${postData.tiktokId}:`, error)
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

export class TikTokBulkUpsertService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Bulk upsert profile and posts
   */
  async bulkUpsert(
    profileData: ProfileData,
    postsData: PostData[],
    options?: { forceRecache?: boolean }
  ): Promise<BulkUpsertResult> {
    const forceRecache = options?.forceRecache || false
    console.log(`🔄 [BulkUpsertService] Bulk upsert starting`, {
      handle: profileData.handle,
      postsCount: postsData.length,
      forceRecache
    })
    // Cache profile avatar if available (outside transaction)
    let profileAvatarId: string | undefined

    if (profileData.avatar) {
      try {
        console.log(`🚀 [BulkUpsertService] Caching profile avatar for: ${profileData.handle}`)
        const avatarCacheAssetId = await mediaCacheServiceV2.cacheAvatar(profileData.avatar, undefined, forceRecache)
        if (avatarCacheAssetId) {
          profileAvatarId = avatarCacheAssetId
          console.log(`✅ [BulkUpsertService] Profile avatar cached successfully for: ${profileData.handle}`)
        }
      } catch (error) {
        console.error(`❌ [BulkUpsertService] Failed to cache profile avatar for ${profileData.handle}:`, error)
      }
    }

    // Check which posts already exist to avoid unnecessary media caching
    console.log(`🔍 [BulkUpsertService] Checking for existing posts among ${postsData.length} posts`)
    const tiktokIds = postsData.map(p => p.tiktokId)
    const existingPostsInDb = await this.prisma.tiktokPost.findMany({
      where: {
        tiktokId: {
          in: tiktokIds
        }
      },
      select: {
        tiktokId: true,
        videoId: true,
        coverId: true,
        musicId: true,
        authorAvatarId: true,
        images: true
      }
    })

    // Create a map for quick lookup
    const existingPostsMap = new Map(existingPostsInDb.map(p => [p.tiktokId, p]))

    // Split posts into new and existing
    const newPosts = postsData.filter(p => !existingPostsMap.has(p.tiktokId))
    const existingPosts = postsData.filter(p => existingPostsMap.has(p.tiktokId))

    console.log(`📊 [BulkUpsertService] Found ${newPosts.length} new posts and ${existingPosts.length} existing posts`)

    // Cache media for NEW posts (always) and EXISTING posts (if forceRecache is enabled)
    const postsToCache = forceRecache ? postsData : newPosts
    console.log(`🚀 [BulkUpsertService] Starting media caching for ${postsToCache.length} posts ${forceRecache ? '(force recache enabled)' : '(new posts only)'}`)

    const postsWithCachedMedia = await Promise.all(
      postsToCache.map(async (postData) => {
        const isNew = !existingPostsMap.has(postData.tiktokId)
        console.log(`🔄 [BulkUpsertService] Caching media for ${isNew ? 'new' : 'existing'} post: ${postData.tiktokId}`)
        const cachedMedia = await cachePostMedia(postData, forceRecache)
        return {
          postData,
          cachedMedia,
          isNew
        }
      })
    )

    // For existing posts that we didn't recache, reuse their current cache asset IDs
    if (!forceRecache && existingPosts.length > 0) {
      const existingPostsWithReusedMedia = existingPosts.map((postData) => {
        const existingPost = existingPostsMap.get(postData.tiktokId)!
        console.log(`♻️ [BulkUpsertService] Reusing cached media for existing post: ${postData.tiktokId}`)
        return {
          postData,
          cachedMedia: {
            cachedVideo: existingPost.videoId,
            cachedCover: existingPost.coverId,
            cachedMusic: existingPost.musicId,
            cachedImages: typeof existingPost.images === 'string' ? JSON.parse(existingPost.images) : existingPost.images,
            cachedAuthorAvatar: existingPost.authorAvatarId
          },
          isNew: false
        }
      })
      postsWithCachedMedia.push(...existingPostsWithReusedMedia)
    }

    console.log(`✅ [BulkUpsertService] Media caching completed: ${postsToCache.length} cached${!forceRecache ? `, ${existingPosts.length} reused` : ''}`)

    // Process database operations in smaller batches to avoid timeout
    console.log(`🚀 [BulkUpsertService] Starting database operations for ${postsWithCachedMedia.length} posts`)

    // First, upsert the profile in a separate transaction
    const profile = await this.prisma.$transaction(async (tx) => {
      console.log(`🔄 [BulkUpsertService] Upserting profile: ${profileData.handle}`)
      return tx.tiktokProfile.upsert({
        where: { handle: profileData.handle },
        create: {
          handle: profileData.handle,
          nickname: sanitizeString(profileData.nickname),
          avatarId: profileAvatarId,
          bio: sanitizeString(profileData.bio),
          verified: profileData.verified || false
        },
        update: {
          nickname: sanitizeString(profileData.nickname),
          avatarId: profileAvatarId,
          bio: sanitizeString(profileData.bio),
          verified: profileData.verified || false,
          updatedAt: new Date()
        }
      })
    })
    console.log(`✅ [BulkUpsertService] Profile upserted successfully: ${profileData.handle}`)

    // Then process posts in smaller batches of 5 to avoid transaction timeout
    const batchSize = 5
    const postBatches = chunkArray(postsWithCachedMedia, batchSize)
    let createdCount = 0
    let updatedCount = 0

    console.log(`📦 [BulkUpsertService] Processing ${postBatches.length} batches of ${batchSize} posts each`)

    for (let i = 0; i < postBatches.length; i++) {
      const batch = postBatches[i]
      console.log(`🔄 [BulkUpsertService] Processing batch ${i + 1}/${postBatches.length}`)

      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          batch.map(async ({ postData, cachedMedia, isNew }) => {
            console.log(`🔄 [BulkUpsertService] Upserting post in DB: ${postData.tiktokId}`)

            // Prepare post data with cached media (using CacheAsset ID pattern)
            const postCreateData = {
              tiktokId: postData.tiktokId,
              profileId: profile.id,
              tiktokUrl: postData.tiktokUrl,
              contentType: postData.contentType,
              title: sanitizeString(postData.title),
              description: sanitizeString(postData.description),
              authorNickname: sanitizeString(postData.authorNickname),
              authorHandle: postData.authorHandle,
              authorAvatarId: cachedMedia.cachedAuthorAvatar,
              hashtags: safeStringify(postData.hashtags),
              mentions: safeStringify(postData.mentions),
              viewCount: BigInt(postData.viewCount),
              likeCount: postData.likeCount,
              shareCount: postData.shareCount,
              commentCount: postData.commentCount,
              saveCount: postData.saveCount,
              duration: postData.duration,
              videoId: cachedMedia.cachedVideo,
              coverId: cachedMedia.cachedCover,
              musicId: cachedMedia.cachedMusic,
              images: safeStringify(cachedMedia.cachedImages.length > 0 ? cachedMedia.cachedImages : postData.images),
              publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null
            }

            // For updates, only update metrics and metadata, NOT media cache IDs
            const postUpdateData = {
              tiktokUrl: postData.tiktokUrl,
              contentType: postData.contentType,
              title: sanitizeString(postData.title),
              description: sanitizeString(postData.description),
              authorNickname: sanitizeString(postData.authorNickname),
              authorHandle: postData.authorHandle,
              // Reuse existing cache IDs for updates (don't overwrite)
              hashtags: safeStringify(postData.hashtags),
              mentions: safeStringify(postData.mentions),
              // Update metrics (these change over time)
              viewCount: BigInt(postData.viewCount),
              likeCount: postData.likeCount,
              shareCount: postData.shareCount,
              commentCount: postData.commentCount,
              saveCount: postData.saveCount,
              duration: postData.duration,
              publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null,
              updatedAt: new Date()
            }

            try {
              await tx.tiktokPost.upsert({
                where: { tiktokId: postData.tiktokId },
                create: postCreateData,
                update: postUpdateData
              })

              if (isNew) {
                createdCount++
                console.log(`➕ [BulkUpsertService] Created post: ${postData.tiktokId}`)
              } else {
                updatedCount++
                console.log(`📝 [BulkUpsertService] Updated post: ${postData.tiktokId}`)
              }
            } catch (upsertError) {
              console.error(`❌ [BulkUpsertService] Failed to upsert post ${postData.tiktokId}:`, upsertError)

              // Capture error with full context in Sentry
              try {
                const Sentry = await import('@sentry/node')
                Sentry.withScope((scope) => {
                  scope.setTag('error-type', 'post-upsert-failed')
                  scope.setTag('tiktok-id', postData.tiktokId)
                  scope.setTag('content-type', postData.contentType)
                  scope.setContext('post-data', {
                    tiktokId: postData.tiktokId,
                    tiktokUrl: postData.tiktokUrl,
                    contentType: postData.contentType,
                    title: postData.title,
                    description: postData.description,
                    authorHandle: postData.authorHandle,
                    hashtags: postData.hashtags,
                    mentions: postData.mentions,
                    isNew
                  })
                  scope.setContext('sanitized-data', {
                    title: sanitizeString(postData.title),
                    description: sanitizeString(postData.description),
                    hashtags: safeStringify(postData.hashtags),
                    mentions: safeStringify(postData.mentions)
                  })
                  Sentry.captureException(upsertError)
                })
              } catch (sentryError) {
                console.error('Failed to send error to Sentry:', sentryError)
              }

              // Re-throw to fail the transaction
              throw upsertError
            }
          })
        )
      })

      // Small delay between batches to be respectful to the database
      if (postBatches.length > 1) {
        console.log(`⏳ [BulkUpsertService] Waiting 500ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Calculate aggregated metrics from all profile posts
    console.log(`🔄 [BulkUpsertService] Calculating aggregated metrics for profile: ${profileData.handle}`)
    const aggregatedMetrics = await this.prisma.tiktokPost.aggregate({
      where: { profileId: profile.id },
      _count: { id: true },
      _sum: {
        viewCount: true,
        likeCount: true,
        shareCount: true,
        commentCount: true,
        saveCount: true
      }
    })

    // Update profile with aggregated metrics
    await this.prisma.tiktokProfile.update({
      where: { id: profile.id },
      data: {
        totalPosts: aggregatedMetrics._count.id,
        totalViews: aggregatedMetrics._sum.viewCount || BigInt(0),
        totalLikes: BigInt(aggregatedMetrics._sum.likeCount || 0),
        totalShares: BigInt(aggregatedMetrics._sum.shareCount || 0),
        totalComments: BigInt(aggregatedMetrics._sum.commentCount || 0),
        totalSaves: BigInt(aggregatedMetrics._sum.saveCount || 0),
        updatedAt: new Date()
      }
    })

    console.log(`✅ [BulkUpsertService] Updated profile metrics:`, {
      totalPosts: aggregatedMetrics._count.id,
      totalViews: aggregatedMetrics._sum.viewCount?.toString() || '0',
      totalLikes: aggregatedMetrics._sum.likeCount || 0
    })

    console.log(`✅ [BulkUpsertService] Completed bulk upsert for profile ${profileData.handle}:`, {
      totalPosts: postsData.length,
      postsCreated: createdCount,
      postsUpdated: updatedCount,
      profileAvatarCached: !!profileAvatarId
    })

    return {
      stats: {
        postsCreated: createdCount,
        postsUpdated: updatedCount,
        totalPosts: postsData.length
      },
      profileId: profile.id
    }
  }
}
