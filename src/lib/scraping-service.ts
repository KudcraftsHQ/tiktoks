import { z } from 'zod'
import { mediaCacheServiceV2 } from './media-cache-service-v2'

const ImageSchema = z.object({
  display_image: z.object({
    height: z.number(),
    width: z.number(),
    url_list: z.array(z.string())
  })
})

const AuthorSchema = z.object({
  nickname: z.string(),
  unique_id: z.string(),
  avatar_medium: z.object({
    url_list: z.array(z.string())
  })
})

const StatisticsSchema = z.object({
  collect_count: z.number(),
  comment_count: z.number(),
  digg_count: z.number(),
  play_count: z.number(),
  share_count: z.number()
})

const ApiResponseSchema = z.object({
  aweme_detail: z.object({
    desc: z.string(),
    author: AuthorSchema,
    statistics: StatisticsSchema,
    image_post_info: z.object({
      images: z.array(ImageSchema)
    })
  })
})

interface HashtagWithUrl {
  text: string
  url: string
}

function extractHashtags(description: string): HashtagWithUrl[] {
  const hashtagRegex = /#[\w\u00c0-\u017f]+/gi
  const hashtags = description.match(hashtagRegex) || []
  
  return hashtags.map(tag => ({
    text: tag,
    url: `https://www.tiktok.com/tag/${tag.slice(1)}`
  }))
}

function generateTitle(description: string): string {
  // Remove hashtags and clean up description for title
  const withoutHashtags = description.replace(/#[\w\u00c0-\u017f]+/gi, '').trim()
  const cleaned = withoutHashtags.replace(/\s+/g, ' ').trim()
  
  if (cleaned.length === 0) {
    return 'TikTok Carousel'
  }
  
  // Take first 50 characters for title
  return cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned
}

interface ScrapedData {
  title: string
  description: string
  author: string
  authorHandle: string
  authorAvatar: string
  authorAvatarKey?: string
  tags: HashtagWithUrl[]
  viewCount: number
  likeCount: number
  shareCount: number
  saveCount: number
  commentCount: number
  images: Array<{
    imageUrl: string
    imageKey?: string // Now stores cache asset ID
    width: number
    height: number
  }>
}

export async function scrapeCarousel(url: string): Promise<ScrapedData> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) {
    throw new Error('SCRAPECREATORS_API_KEY is not configured')
  }

  try {
    const response = await fetch(`https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const rawData = await response.json()
    
    // Validate the response structure
    const data = ApiResponseSchema.parse(rawData)
    
    const awemeDetail = data.aweme_detail
    
    if (!awemeDetail.image_post_info?.images || awemeDetail.image_post_info.images.length === 0) {
      throw new Error('No images found in the carousel')
    }

    const description = awemeDetail.desc || ''
    const tags = extractHashtags(description)
    const title = generateTitle(description)

    // Extract original URLs before caching
    const originalImages = awemeDetail.image_post_info.images.map(image => ({
      imageUrl: image.display_image.url_list[0] || '',
      width: image.display_image.width,
      height: image.display_image.height
    }))

    const originalAuthorAvatar = awemeDetail.author.avatar_medium?.url_list[0] || ''

    // Queue media for background caching and get cache asset IDs
    let cachedImages: Array<{ imageUrl: string; imageKey?: string; width: number; height: number }> = []
    let cachedAuthorAvatar = originalAuthorAvatar
    let authorAvatarKey: string | undefined

    if (originalImages.length > 0 || originalAuthorAvatar) {
      try {
        const cacheResult = await mediaCacheServiceV2.cacheCarouselMedia(
          originalImages,
          originalAuthorAvatar || undefined
        )

        cachedImages = cacheResult.cachedImages.map((img, index) => ({
          imageUrl: originalImages[index]?.imageUrl || '', // Keep original URL
          imageKey: img.cacheAssetId || undefined, // Store cache asset ID
          width: img.width || 0,
          height: img.height || 0
        }))

        if (cacheResult.cachedAuthorAvatarId) {
          authorAvatarKey = cacheResult.cachedAuthorAvatarId // Store cache asset ID
        }

        // Log any caching errors
        if (cacheResult.errors.length > 0) {
          console.warn('Media caching warnings:', cacheResult.errors)
        }
      } catch (error) {
        console.error('Failed to queue media for caching, using original URLs:', error)
        // Fall back to original data
        cachedImages = originalImages
        cachedAuthorAvatar = originalAuthorAvatar
      }
    } else {
      cachedImages = originalImages
    }

    return {
      title,
      description,
      author: awemeDetail.author.nickname || 'Unknown Author',
      authorHandle: awemeDetail.author.unique_id || '',
      authorAvatar: cachedAuthorAvatar,
      authorAvatarKey,
      tags,
      viewCount: awemeDetail.statistics.play_count || 0,
      likeCount: awemeDetail.statistics.digg_count || 0,
      shareCount: awemeDetail.statistics.share_count || 0,
      saveCount: awemeDetail.statistics.collect_count || 0,
      commentCount: awemeDetail.statistics.comment_count || 0,
      images: cachedImages
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('API response validation failed:', error.issues)
      throw new Error('Invalid API response structure')
    }
    console.error('Error scraping carousel:', error)
    throw error instanceof Error ? error : new Error('Failed to scrape carousel')
  }
}