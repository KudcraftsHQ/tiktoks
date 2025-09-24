import { z } from 'zod'
import { getCachedData, setCachedData, CACHE_KEYS, CACHE_TTL } from './redis-cache'

// Zod schemas for TikTok Profile Videos API

const ImagePostSchema = z.object({
  display_image: z.object({
    height: z.number(),
    width: z.number(),
    url_list: z.array(z.string())
  })
})

const VideoSchema = z.object({
  height: z.number().optional(),
  width: z.number().optional(),
  play_addr: z.object({
    url_list: z.array(z.string())
  }).optional(),
  cover: z.object({
    url_list: z.array(z.string())
  }).optional(),
  duration: z.number().optional()
}).passthrough()

const MusicSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  play_url: z.object({
    url_list: z.array(z.string())
  }).optional()
})

const AuthorSchema = z.object({
  nickname: z.string().optional().default(''),
  unique_id: z.string().optional().default(''),
  avatar_medium: z.object({
    url_list: z.array(z.string())
  }).optional(),
  avatar_larger: z.object({
    url_list: z.array(z.string())
  }).optional(),
  signature: z.string().optional(),
  verified: z.boolean().optional()
}).passthrough()

const StatisticsSchema = z.object({
  play_count: z.number().optional().default(0),
  digg_count: z.number().optional().default(0),
  comment_count: z.number().optional().default(0),
  share_count: z.number().optional().default(0),
  collect_count: z.number().optional().default(0)
}).passthrough()

const AwemeItemSchema = z.object({
  aweme_id: z.string(),
  desc: z.string().optional().default(''),
  create_time: z.number(),
  author: AuthorSchema,
  statistics: StatisticsSchema,
  video: VideoSchema.optional(),
  image_post_info: z.object({
    images: z.array(ImagePostSchema)
  }).optional(),
  music: MusicSchema.optional(),
  share_url: z.string().optional()
}).passthrough() // Allow additional unknown fields

const ProfileVideosResponseSchema = z.object({
  aweme_list: z.array(AwemeItemSchema).optional().default([]),
  has_more: z.union([z.number(), z.boolean()]).optional(),
  max_cursor: z.union([z.number(), z.string()]).optional(),
  min_cursor: z.union([z.number(), z.string()]).optional(),
  status_code: z.number().optional(),
  extra: z.object({
    fatal_item_ids: z.array(z.any()).optional(),
    logid: z.string().optional(),
    now: z.number().optional()
  }).optional(),
  has_locate_item: z.boolean().optional(),
  log_pb: z.object({
    impr_id: z.string().optional()
  }).optional(),
  status_msg: z.string().optional()
}).passthrough()

// Types
export interface TikTokPost {
  id: string
  tiktokId: string
  tiktokUrl: string
  contentType: 'video' | 'photo'
  title: string
  description: string
  authorNickname: string
  authorHandle: string
  authorAvatar: string
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
  images: Array<{
    url: string
    width: number
    height: number
  }>
  publishedAt: Date
}

export interface ProfileData {
  handle: string
  nickname?: string
  avatar?: string
  bio?: string
  verified?: boolean
  // Note: Follower counts and other metrics are not available in the videos API response
}

export interface ProfileVideosResult {
  posts: TikTokPost[]
  profile?: ProfileData
  hasMore: boolean
  maxCursor?: string
  minCursor?: string
}

function extractHashtags(description: string): Array<{ text: string; url: string }> {
  const hashtagRegex = /#[\w\u00c0-\u017f]+/gi
  const hashtags = description.match(hashtagRegex) || []

  return hashtags.map(tag => ({
    text: tag,
    url: `https://www.tiktok.com/tag/${tag.slice(1)}`
  }))
}

function extractMentions(description: string): string[] {
  const mentionRegex = /@[\w\u00c0-\u017f.]+/gi
  const mentions = description.match(mentionRegex) || []

  return mentions.map(mention => mention.slice(1)) // Remove @ symbol
}

function generateTitle(description: string): string {
  const withoutHashtags = description.replace(/#[\w\u00c0-\u017f]+/gi, '').trim()
  const withoutMentions = withoutHashtags.replace(/@[\w\u00c0-\u017f.]+/gi, '').trim()
  const cleaned = withoutMentions.replace(/\s+/g, ' ').trim()

  if (cleaned.length === 0) {
    return 'TikTok Post'
  }

  return cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned
}

function generateTikTokUrl(authorHandle: string, awemeId: string): string {
  return `https://www.tiktok.com/@${authorHandle}/video/${awemeId}`
}

export async function scrapeProfileVideos(
  handle: string,
  maxCursor?: string,
  trim: boolean = true
): Promise<ProfileVideosResult> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) {
    throw new Error('SCRAPECREATORS_API_KEY is not configured')
  }

  // Build cache params
  const cacheParams = { handle, max_cursor: maxCursor || '', trim }

  // Try to get cached data first
  const cachedData = await getCachedData(CACHE_KEYS.PROFILE_VIDEOS, cacheParams)
  if (cachedData) {
    console.log('Returning cached profile videos data')
    return cachedData
  }

  let rawData: any = null

  try {
    // Build API URL
    const baseUrl = 'https://api.scrapecreators.com/v3/tiktok/profile/videos'
    const params = new URLSearchParams({ handle, trim: trim.toString() })
    if (maxCursor) {
      params.append('max_cursor', maxCursor)
    }

    const apiUrl = `${baseUrl}?${params.toString()}`

    console.log('Fetching profile videos from TikTok API:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey
      }
    })

    if (!response.ok) {
      console.error(`API request failed with status ${response.status}: ${response.statusText}`)
      const errorText = await response.text()
      console.error('Error response body:', errorText)
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`)
    }

    rawData = await response.json()
    console.log('Raw API response:', JSON.stringify(rawData, null, 2))

    // Validate the response structure
    console.log('Validating response structure...')
    const data = ProfileVideosResponseSchema.parse(rawData)

    if (data.status_code !== undefined && data.status_code !== 0) {
      console.error(`API returned error status: ${data.status_code}, message: ${data.status_msg || 'No message'}`)
      throw new Error(`API returned error status: ${data.status_code}`)
    }

    // Process the posts
    const posts: TikTokPost[] = data.aweme_list.map(item => {
      const description = item.desc || ''
      const hashtags = extractHashtags(description)
      const mentions = extractMentions(description)
      const title = generateTitle(description)
      const tiktokUrl = item.share_url || generateTikTokUrl(item.author.unique_id, item.aweme_id)

      // Determine content type and extract media info
      const isVideoPost = !!item.video
      const isPhotoPost = !!item.image_post_info?.images?.length

      let contentType: 'video' | 'photo' = 'video'
      let videoUrl: string | undefined
      let coverUrl: string | undefined
      let duration: number | undefined
      let images: Array<{ url: string; width: number; height: number }> = []

      if (isPhotoPost) {
        contentType = 'photo'
        images = item.image_post_info!.images.map(img => ({
          url: img.display_image.url_list[0] || '',
          width: img.display_image.width,
          height: img.display_image.height
        }))
        // Use first image as cover for photo posts
        coverUrl = images[0]?.url
      } else if (isVideoPost && item.video) {
        contentType = 'video'
        videoUrl = item.video.play_addr.url_list[0] || ''
        coverUrl = item.video.cover.url_list[0] || ''
        duration = item.video.duration
      }

      return {
        id: '', // Will be set when saved to database
        tiktokId: item.aweme_id,
        tiktokUrl,
        contentType,
        title,
        description,
        authorNickname: item.author.nickname,
        authorHandle: item.author.unique_id,
        authorAvatar: item.author.avatar_medium.url_list[0] || '',
        hashtags,
        mentions,
        viewCount: item.statistics.play_count,
        likeCount: item.statistics.digg_count,
        shareCount: item.statistics.share_count,
        commentCount: item.statistics.comment_count,
        saveCount: item.statistics.collect_count || 0,
        duration,
        videoUrl,
        coverUrl,
        musicUrl: item.music?.play_url?.url_list[0],
        images,
        publishedAt: new Date(item.create_time * 1000) // Convert from Unix timestamp
      }
    })

    // Extract profile data from the first post's author info
    let profileData: ProfileData | undefined
    if (posts.length > 0) {
      const firstPost = data.aweme_list[0]
      profileData = {
        handle: handle,
        nickname: firstPost.author.nickname || undefined,
        avatar: firstPost.author.avatar_medium?.url_list[0] || undefined,
        bio: firstPost.author.signature || undefined,
        verified: firstPost.author.verified || undefined
      }
    }

    const result: ProfileVideosResult = {
      posts,
      profile: profileData,
      hasMore: !!data.has_more,
      maxCursor: data.max_cursor?.toString(),
      minCursor: data.min_cursor?.toString()
    }

    // Cache the result for 1 hour
    await setCachedData(CACHE_KEYS.PROFILE_VIDEOS, result, CACHE_TTL.ONE_HOUR, cacheParams)

    return result
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('API response validation failed:', error.issues)
      if (rawData) {
        console.error('Raw response that failed validation:', JSON.stringify(rawData, null, 2))
      }
      // Show detailed validation errors
      const validationErrors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
      throw new Error(`Invalid API response structure: ${validationErrors}`)
    }
    console.error('Error scraping profile videos:', error)
    throw error instanceof Error ? error : new Error('Failed to scrape profile videos')
  }
}