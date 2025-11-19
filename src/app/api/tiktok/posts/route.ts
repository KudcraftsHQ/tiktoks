import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'
import { mediaCacheServiceV2 } from '@/lib/media-cache-service-v2'
import { cacheAssetService } from '@/lib/cache-asset-service'
import { notificationService } from '@/lib/notification-service'
import * as Sentry from '@sentry/nextjs'

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
  let body: any
  try {
    body = await request.json()
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

    // Check for high views and send notification if needed (non-blocking)
    notificationService.checkAndNotifyHighViews(post).catch(error => {
      console.error('Failed to check for notifications:', error)
      // Don't fail the request if notification check fails
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

    // Capture error in Sentry with context
    Sentry.withScope((scope) => {
      scope.setTag('api-route', '/api/tiktok/posts')
      scope.setTag('http-method', 'POST')
      scope.setContext('request-body', {
        hasData: !!body,
        // Don't log full body as it might be large
      })
      Sentry.captureException(error)
    })

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
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const includeTimeAnalysis = searchParams.get('includeTimeAnalysis') === 'true'
    const includeActivityData = searchParams.get('includeActivityData') === 'true'
    const timezone = searchParams.get('timezone') || 'UTC' // Client's IANA timezone (e.g., 'Asia/Jakarta')

    // New advanced filters
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || []
    const profileGroupIds = searchParams.get('profileGroupIds')?.split(',').filter(Boolean) || []
    const viewCountGt = searchParams.get('viewCountGt')
    const viewCountLt = searchParams.get('viewCountLt')
    const ocrStatus = searchParams.get('ocrStatus') || 'all'

    // Parse sorting from URL - supports multi-column sorting
    // Format: ?sort=viewCount.desc,likeCount.asc,publishedAt.desc
    // Backward compatible with old format: ?sortBy=viewCount&sortOrder=desc
    const sortParam = searchParams.get('sort')
    const oldSortBy = searchParams.get('sortBy')
    const oldSortOrder = searchParams.get('sortOrder')

    let orderBy: any

    if (sortParam) {
      // New format: multi-column sorting
      orderBy = sortParam.split(',').map(sort => {
        const [field, direction] = sort.trim().split('.')
        return { [field]: direction || 'desc' }
      })
    } else if (oldSortBy) {
      // Backward compatibility: old single-column format
      orderBy = { [oldSortBy]: oldSortOrder || 'desc' }
    } else {
      // Default sorting
      orderBy = { publishedAt: 'desc' }
    }

    const skip = (page - 1) * limit

    // Fetch profile IDs from selected profile groups
    let profileIdsFromGroups: string[] = []
    if (profileGroupIds.length > 0) {
      const profilesInGroups = await prisma.tiktokProfile.findMany({
        where: {
          profileGroupId: {
            in: profileGroupIds
          }
        },
        select: {
          id: true
        }
      })
      profileIdsFromGroups = profilesInGroups.map(p => p.id)
    }

    // Build where clause
    const where: any = {}

    if (contentType && ['video', 'photo'].includes(contentType)) {
      where.contentType = contentType
    }

    if (authorHandle) {
      where.authorHandle = authorHandle
    }

    if (categoryId && categoryId !== 'all') {
      where.postCategoryId = categoryId
    }

    // Filter by account IDs (profile IDs) - combine accountIds and profileGroupIds
    const combinedProfileIds = [...accountIds, ...profileIdsFromGroups]
    if (combinedProfileIds.length > 0) {
      where.profileId = {
        in: combinedProfileIds
      }
    }

    // Filter by view count range
    if (viewCountGt || viewCountLt) {
      where.viewCount = {}
      if (viewCountGt) {
        where.viewCount.gte = BigInt(viewCountGt)
      }
      if (viewCountLt) {
        where.viewCount.lte = BigInt(viewCountLt)
      }
    }

    // Date range filtering on publishedAt
    if (dateFrom || dateTo) {
      where.publishedAt = {}
      if (dateFrom) {
        where.publishedAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.publishedAt.lte = new Date(dateTo)
      }
    }

    // Multi-term search with AND logic
    // Example: "accounts post" will search for posts containing BOTH "accounts" AND "post"
    if (search) {
      // Split by spaces and filter empty terms
      const searchTerms = search
        .split(/\s+/)
        .map(term => term.trim())
        .filter(term => term.length >= 2) // Minimum 2 characters per term

      if (searchTerms.length > 0) {
        // Each term must match at least one field (AND across terms, OR across fields)
        where.AND = searchTerms.map(term => ({
          OR: [
            {
              description: {
                contains: term,
                mode: 'insensitive' as const
              }
            },
            {
              authorNickname: {
                contains: term,
                mode: 'insensitive' as const
              }
            },
            {
              authorHandle: {
                contains: term,
                mode: 'insensitive' as const
              }
            },
            // Search in OCR texts (JSON field converted to text)
            {
              ocrTexts: {
                string_contains: term // Case-insensitive JSON text search
              }
            }
          ]
        }))
      }
    }

    // Filter by OCR status
    if (ocrStatus === 'processed') {
      where.ocrTexts = {
        not: null
      }
    } else if (ocrStatus === 'unprocessed') {
      where.ocrTexts = null
    }

    const [posts, total] = await Promise.all([
      prisma.tiktokPost.findMany({
        where,
        include: {
          profile: {
            select: {
              handle: true,
              nickname: true,
              avatarId: true
            }
          },
          postCategory: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              remixes: true
            }
          }
        },
        orderBy,
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

    // Parse all images from all posts and collect all image IDs for bulk fetching
    const parsedPostImages: Array<{ postIndex: number; images: any[] }> = []
    const allImageIds: Array<string | null> = []

    posts.forEach((post, index) => {
      try {
        const parsedImages = typeof post.images === 'string'
          ? JSON.parse(post.images || '[]')
          : Array.isArray(post.images) ? post.images : []

        parsedPostImages.push({ postIndex: index, images: parsedImages })

        // Collect all image IDs for bulk fetching
        parsedImages.forEach((img: any) => {
          allImageIds.push(img.cacheAssetId || null)
        })
      } catch (error) {
        console.warn('Failed to parse images for post:', post.id, error)
        parsedPostImages.push({ postIndex: index, images: [] })
      }
    })

    // Fetch all presigned URLs in bulk (one query for all images across all posts)
    const [presignedVideoUrls, presignedCoverUrls, presignedMusicUrls, presignedAvatarUrls, allPresignedImageUrls] = await Promise.all([
      cacheAssetService.getUrls(videoIds),
      cacheAssetService.getUrls(coverIds),
      cacheAssetService.getUrls(musicIds),
      cacheAssetService.getUrls(avatarIds),
      cacheAssetService.getUrls(allImageIds)
    ])

    // Convert BigInt to string for JSON serialization and add presigned URLs
    let imageUrlIndex = 0
    const responsePosts = posts.map((post, index) => {
      const postImages = parsedPostImages.find(p => p.postIndex === index)
      let images = []

      if (postImages && postImages.images.length > 0) {
        images = postImages.images.map((img: any) => {
          const url = allPresignedImageUrls[imageUrlIndex++]
          return {
            ...img,
            url
          }
        })
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

      // Parse OCR-related fields
      let ocrTexts = null
      let imageDescriptions = null
      let slideClassifications = null

      try {
        ocrTexts = post.ocrTexts
          ? (typeof post.ocrTexts === 'string' ? JSON.parse(post.ocrTexts) : post.ocrTexts)
          : null
      } catch (error) {
        console.warn('Failed to parse ocrTexts for post:', post.id, error)
      }

      try {
        imageDescriptions = post.imageDescriptions
          ? (typeof post.imageDescriptions === 'string' ? JSON.parse(post.imageDescriptions) : post.imageDescriptions)
          : null
      } catch (error) {
        console.warn('Failed to parse imageDescriptions for post:', post.id, error)
      }

      try {
        slideClassifications = post.slideClassifications
          ? (typeof post.slideClassifications === 'string' ? JSON.parse(post.slideClassifications) : post.slideClassifications)
          : null
      } catch (error) {
        console.warn('Failed to parse slideClassifications for post:', post.id, error)
      }

      return {
        ...post,
        viewCount: post.viewCount?.toString() || '0',
        videoUrl: presignedVideoUrls[index],
        coverUrl: presignedCoverUrls[index],
        musicUrl: presignedMusicUrls[index],
        authorAvatar: presignedAvatarUrls[index],
        images: images,
        hashtags: hashtags,
        mentions: mentions,
        ocrTexts: ocrTexts,
        imageDescriptions: imageDescriptions,
        slideClassifications: slideClassifications
      }
    })

    // Calculate aggregate metrics from all posts matching filters
    const aggregateResult = await prisma.tiktokPost.aggregate({
      where,
      _count: {
        id: true
      },
      _sum: {
        viewCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true
      }
    })

    const aggregateMetrics = {
      totalPosts: aggregateResult._count.id || 0,
      totalViews: Number(aggregateResult._sum.viewCount || 0),
      totalLikes: aggregateResult._sum.likeCount || 0,
      totalComments: aggregateResult._sum.commentCount || 0,
      totalShares: aggregateResult._sum.shareCount || 0,
      avgViews: aggregateResult._count.id
        ? Math.round(Number(aggregateResult._sum.viewCount || 0) / aggregateResult._count.id)
        : 0
    }

    // Calculate activity data if requested (for heatmap)
    let activityData
    let firstPostDate = null
    if (includeActivityData) {
      // Get the earliest post date for context
      const earliestPost = await prisma.tiktokPost.findFirst({
        where,
        select: {
          publishedAt: true
        },
        orderBy: {
          publishedAt: 'asc'
        }
      })

      if (earliestPost?.publishedAt) {
        firstPostDate = earliestPost.publishedAt.toISOString()
      }

      // Group posts by date
      const allPostsForActivity = await prisma.tiktokPost.findMany({
        where,
        select: {
          publishedAt: true
        }
      })

      // Create date map
      const dateMap = new Map<string, number>()
      allPostsForActivity.forEach(post => {
        if (!post.publishedAt) return
        const dateKey = post.publishedAt.toISOString().split('T')[0]
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
      })

      activityData = Array.from(dateMap.entries()).map(([date, count]) => ({
        date,
        count
      }))
    }

    // Calculate time analysis if requested
    let timeAnalysis
    if (includeTimeAnalysis) {
      // Fetch all posts (not paginated) for time analysis
      const allPosts = await prisma.tiktokPost.findMany({
        where,
        select: {
          publishedAt: true,
          viewCount: true,
          likeCount: true,
          commentCount: true
        }
      })

      // Group by hour in user's local timezone
      const hourlyMap = new Map<number, {
        postCount: number
        totalViews: number
        totalLikes: number
        totalComments: number
      }>()

      allPosts.forEach(post => {
        if (!post.publishedAt) return

        // Convert to user's timezone to extract hour
        // Use Intl.DateTimeFormat with the client's timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false
        })
        const parts = formatter.formatToParts(post.publishedAt)
        const hourPart = parts.find(part => part.type === 'hour')
        const hour = hourPart ? parseInt(hourPart.value) : 0

        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, {
            postCount: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0
          })
        }

        const hourData = hourlyMap.get(hour)!
        hourData.postCount += 1
        hourData.totalViews += Number(post.viewCount || 0)
        hourData.totalLikes += post.likeCount || 0
        hourData.totalComments += post.commentCount || 0
      })

      // Convert to array and calculate averages
      const hourlyData = Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({
          hour,
          postCount: data.postCount,
          totalViews: data.totalViews,
          avgViews: Math.round(data.totalViews / data.postCount),
          totalLikes: data.totalLikes,
          totalComments: data.totalComments,
          avgEngagementRate: (data.totalLikes + data.totalComments) / Math.max(data.totalViews, 1)
        }))
        .sort((a, b) => a.hour - b.hour)

      // Get top 3 hours by average views
      const bestTimes = hourlyData
        .sort((a, b) => b.avgViews - a.avgViews)
        .slice(0, 3)
        .map(d => ({
          hour: d.hour,
          avgViews: d.avgViews,
          postCount: d.postCount
        }))

      timeAnalysis = {
        hourlyData,
        bestTimes
      }
    }

    const response: any = {
      posts: responsePosts,
      hasMore,
      total,
      page,
      limit,
      aggregateMetrics
    }

    if (includeTimeAnalysis) {
      response.timeAnalysis = timeAnalysis
    }

    if (includeActivityData) {
      response.activityData = activityData
      response.firstPostDate = firstPostDate
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}