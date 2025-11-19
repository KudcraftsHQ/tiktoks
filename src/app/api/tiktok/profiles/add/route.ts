import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { mediaCacheServiceV2 } from '@/lib/media-cache-service-v2'
import { scrapeProfileVideos, TikTokPost, ProfileData } from '@/lib/tiktok-scraping'

const prisma = new PrismaClient()

async function createOrUpdateProfile(profileData: ProfileData, isOwnProfile: boolean) {
  const avatarCacheAssetId = profileData.avatar
    ? await mediaCacheServiceV2.cacheImage(profileData.avatar)
    : null

  return prisma.tiktokProfile.upsert({
    where: { handle: profileData.handle },
    create: {
      handle: profileData.handle,
      nickname: profileData.nickname || null,
      avatarId: avatarCacheAssetId,
      bio: profileData.bio || null,
      verified: profileData.verified || false
    },
    update: {
      nickname: profileData.nickname || undefined,
      avatarId: avatarCacheAssetId || undefined,
      bio: profileData.bio || undefined,
      verified: profileData.verified || undefined
    }
  })
}

async function createOrUpdatePosts(
  profileId: string,
  posts: TikTokPost[]
) {
  let created = 0
  let updated = 0

  for (const post of posts) {
    // Cache media assets
    const coverId = post.coverUrl ? await mediaCacheServiceV2.cacheImage(post.coverUrl) : null
    const videoId = post.videoUrl ? await mediaCacheServiceV2.cacheVideo(post.videoUrl) : null
    const musicId = post.musicUrl ? await mediaCacheServiceV2.cacheImage(post.musicUrl) : null
    const authorAvatarId = post.authorAvatar ? await mediaCacheServiceV2.cacheImage(post.authorAvatar) : null

    // Process images for photo posts
    const imagesWithCacheIds = await Promise.all(
      post.images.map(async (img) => ({
        cacheAssetId: await mediaCacheServiceV2.cacheImage(img.url),
        width: img.width,
        height: img.height
      }))
    )

    const existing = await prisma.tiktokPost.findUnique({
      where: { tiktokId: post.tiktokId }
    })

    if (existing) {
      await prisma.tiktokPost.update({
        where: { tiktokId: post.tiktokId },
        data: {
          viewCount: BigInt(post.viewCount),
          likeCount: post.likeCount,
          shareCount: post.shareCount,
          commentCount: post.commentCount,
          saveCount: post.saveCount
        }
      })
      updated++
    } else {
      await prisma.tiktokPost.create({
        data: {
          tiktokId: post.tiktokId,
          profileId,
          tiktokUrl: post.tiktokUrl,
          contentType: post.contentType,
          description: post.description || null,
          videoId,
          coverId,
          musicId,
          images: imagesWithCacheIds,
          authorNickname: post.authorNickname,
          authorHandle: post.authorHandle,
          authorAvatarId,
          hashtags: post.hashtags,
          viewCount: BigInt(post.viewCount),
          likeCount: post.likeCount,
          shareCount: post.shareCount,
          commentCount: post.commentCount,
          saveCount: post.saveCount,
          duration: post.duration || null,
          publishedAt: post.publishedAt
        }
      })
      created++
    }
  }

  return { created, updated, total: posts.length }
}

async function updateProfileMetrics(profileId: string) {
  const aggregated = await prisma.tiktokPost.aggregate({
    where: { profileId },
    _count: { id: true },
    _sum: {
      viewCount: true,
      likeCount: true,
      shareCount: true,
      commentCount: true,
      saveCount: true
    }
  })

  await prisma.tiktokProfile.update({
    where: { id: profileId },
    data: {
      totalPosts: aggregated._count.id,
      totalViews: aggregated._sum.viewCount || BigInt(0),
      totalLikes: BigInt(aggregated._sum.likeCount || 0),
      totalShares: BigInt(aggregated._sum.shareCount || 0),
      totalComments: BigInt(aggregated._sum.commentCount || 0),
      totalSaves: BigInt(aggregated._sum.saveCount || 0)
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { handle, isOwnProfile = false } = await request.json()

    if (!handle) {
      return NextResponse.json(
        { error: 'Handle is required' },
        { status: 400 }
      )
    }

    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

    // Fetch profile and initial posts using existing service
    console.log(`📥 Fetching profile @${cleanHandle} from ScrapeCreators...`)
    const result = await scrapeProfileVideos(cleanHandle, undefined, true)

    if (!result.profile) {
      return NextResponse.json(
        { error: 'No profile data found' },
        { status: 404 }
      )
    }

    // Create/update profile
    console.log(`💾 Creating/updating profile @${cleanHandle}...`)
    const profile = await createOrUpdateProfile(result.profile, isOwnProfile)

    // Create/update posts from first batch
    console.log(`💾 Creating/updating ${result.posts.length} posts...`)
    const postStats = await createOrUpdatePosts(profile.id, result.posts)

    // Update profile metrics
    console.log(`📊 Updating profile metrics...`)
    await updateProfileMetrics(profile.id)

    console.log(`✅ Profile @${cleanHandle} added successfully`)
    console.log(`   - Posts created: ${postStats.created}`)
    console.log(`   - Posts updated: ${postStats.updated}`)

    // TODO: Queue background job for fetching remaining posts if hasMore is true
    // For now, we'll just process the first batch

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        handle: profile.handle
      },
      stats: postStats,
      processing: result.hasMore // Indicate if more posts need processing
    })
  } catch (error) {
    console.error('Failed to add profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add profile' },
      { status: 500 }
    )
  }
}
