import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { mediaCacheServiceV2 } from '@/lib/media-cache-service-v2'

const prisma = new PrismaClient()

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY

interface ScrapeCreatorsProfileResponse {
  user: {
    id: string
    uniqueId: string
    nickname: string
    avatarLarger: string
    signature: string
    verified: boolean
    stats: {
      followerCount: number
      followingCount: number
      videoCount: number
      heartCount: number
    }
  }
  posts: Array<{
    id: string
    desc: string
    createTime: number
    video?: {
      cover: string
      playAddr: string
      duration: number
    }
    imagePost?: {
      images: Array<{
        imageURL: {
          urlList: string[]
        }
        imageWidth: number
        imageHeight: number
      }>
    }
    music?: {
      playUrl: string
      title: string
    }
    author: {
      uniqueId: string
      nickname: string
      avatarLarger: string
    }
    stats: {
      playCount: number
      diggCount: number
      shareCount: number
      commentCount: number
      collectCount: number
    }
    textExtra?: Array<{
      hashtagName?: string
      userId?: string
    }>
  }>
  cursor: string
  hasMore: boolean
}

async function fetchProfileFromScrapeCreators(handle: string): Promise<ScrapeCreatorsProfileResponse> {
  const response = await fetch('https://api.scrapecreators.com/tiktok/profile/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SCRAPECREATORS_API_KEY!
    },
    body: JSON.stringify({
      username: handle,
      count: 35
    })
  })

  if (!response.ok) {
    throw new Error('Failed to fetch profile from ScrapeCreators')
  }

  return response.json()
}

async function createOrUpdateProfile(profileData: ScrapeCreatorsProfileResponse['user'], isOwnProfile: boolean) {
  const avatarCacheAssetId = await mediaCacheServiceV2.cacheImage(profileData.avatarLarger)

  return prisma.tiktokProfile.upsert({
    where: { handle: profileData.uniqueId },
    create: {
      handle: profileData.uniqueId,
      nickname: profileData.nickname,
      avatarId: avatarCacheAssetId,
      bio: profileData.signature || null,
      verified: profileData.verified,
      isOwnProfile
    },
    update: {
      nickname: profileData.nickname,
      avatarId: avatarCacheAssetId,
      bio: profileData.signature || null,
      verified: profileData.verified,
      isOwnProfile: isOwnProfile || undefined // Only update if true
    }
  })
}

async function createOrUpdatePosts(
  profileId: string,
  posts: ScrapeCreatorsProfileResponse['posts']
) {
  let created = 0
  let updated = 0

  for (const post of posts) {
    const tiktokUrl = `https://www.tiktok.com/@${post.author.uniqueId}/video/${post.id}`
    const contentType = post.imagePost ? 'photo' : 'video'

    // Cache media assets
    const coverId = post.video?.cover ? await mediaCacheServiceV2.cacheImage(post.video.cover) : null
    const videoId = post.video?.playAddr ? await mediaCacheServiceV2.cacheVideo(post.video.playAddr) : null
    const musicId = post.music?.playUrl ? await mediaCacheServiceV2.cacheImage(post.music.playUrl) : null // Using cacheImage for audio
    const authorAvatarId = post.author.avatarLarger ? await mediaCacheServiceV2.cacheImage(post.author.avatarLarger) : null

    // Process images for photo posts
    const images = post.imagePost?.images.map((img) => ({
      url: img.imageURL.urlList[0],
      width: img.imageWidth,
      height: img.imageHeight
    })) || []

    const imagesWithCacheIds = await Promise.all(
      images.map(async (img) => ({
        cacheAssetId: await mediaCacheServiceV2.cacheImage(img.url),
        width: img.width,
        height: img.height
      }))
    )

    // Extract hashtags
    const hashtags = post.textExtra
      ?.filter((extra) => extra.hashtagName)
      .map((extra) => ({
        text: extra.hashtagName!,
        url: `https://www.tiktok.com/tag/${extra.hashtagName}`
      })) || []

    const existing = await prisma.tiktokPost.findUnique({
      where: { tiktokId: post.id }
    })

    if (existing) {
      await prisma.tiktokPost.update({
        where: { tiktokId: post.id },
        data: {
          viewCount: BigInt(post.stats.playCount),
          likeCount: post.stats.diggCount,
          shareCount: post.stats.shareCount,
          commentCount: post.stats.commentCount,
          saveCount: post.stats.collectCount
        }
      })
      updated++
    } else {
      await prisma.tiktokPost.create({
        data: {
          tiktokId: post.id,
          profileId,
          tiktokUrl,
          contentType,
          description: post.desc || null,
          videoId,
          coverId,
          musicId,
          images: imagesWithCacheIds,
          authorNickname: post.author.nickname,
          authorHandle: post.author.uniqueId,
          authorAvatarId,
          hashtags,
          viewCount: BigInt(post.stats.playCount),
          likeCount: post.stats.diggCount,
          shareCount: post.stats.shareCount,
          commentCount: post.stats.commentCount,
          saveCount: post.stats.collectCount,
          duration: post.video?.duration || null,
          publishedAt: new Date(post.createTime * 1000)
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

    if (!SCRAPECREATORS_API_KEY) {
      return NextResponse.json(
        { error: 'ScrapeCreators API key not configured' },
        { status: 500 }
      )
    }

    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

    // Fetch profile and initial posts
    console.log(`📥 Fetching profile @${cleanHandle} from ScrapeCreators...`)
    const profileData = await fetchProfileFromScrapeCreators(cleanHandle)

    // Create/update profile
    console.log(`💾 Creating/updating profile @${cleanHandle}...`)
    const profile = await createOrUpdateProfile(profileData.user, isOwnProfile)

    // Create/update posts from first batch
    console.log(`💾 Creating/updating ${profileData.posts.length} posts...`)
    const postStats = await createOrUpdatePosts(profile.id, profileData.posts)

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
        handle: profile.handle,
        isOwnProfile: profile.isOwnProfile
      },
      stats: postStats,
      processing: profileData.hasMore // Indicate if more posts need processing
    })
  } catch (error) {
    console.error('Failed to add profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add profile' },
      { status: 500 }
    )
  }
}
