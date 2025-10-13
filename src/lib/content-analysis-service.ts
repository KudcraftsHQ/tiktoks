import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from './cache-asset-service'

const prisma = new PrismaClient()

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface PostAnalysisData {
  id: string
  authorHandle: string
  authorNickname?: string
  publishedAt: Date
  contentType: string
  slideCount: number
  viewCount: bigint
  likeCount: number
  commentCount: number
  shareCount: number
  saveCount: number
  hashtags: any
  description?: string
  ocrTexts: any
  imageDescriptions: any
}

/**
 * Fetch posts with OCR data for analysis
 */
export async function fetchPostsForAnalysis(postIds: string[]): Promise<PostAnalysisData[]> {
  const posts = await prisma.tiktokPost.findMany({
    where: {
      id: { in: postIds },
      ocrStatus: 'completed' // Only include posts with completed OCR
    },
    select: {
      id: true,
      authorHandle: true,
      authorNickname: true,
      publishedAt: true,
      contentType: true,
      images: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      shareCount: true,
      saveCount: true,
      hashtags: true,
      description: true,
      ocrTexts: true,
      imageDescriptions: true
    }
  })

  return posts.map(post => {
    // Parse images to get slide count
    const images = typeof post.images === 'string'
      ? JSON.parse(post.images || '[]')
      : Array.isArray(post.images) ? post.images : []

    return {
      ...post,
      slideCount: images.length,
      publishedAt: post.publishedAt || new Date()
    }
  })
}

/**
 * Calculate engagement rates
 */
function calculateEngagementRates(post: PostAnalysisData) {
  const views = Number(post.viewCount)
  if (views === 0) {
    return {
      likeRate: 0,
      commentRate: 0,
      shareRate: 0,
      saveRate: 0
    }
  }

  return {
    likeRate: ((post.likeCount / views) * 100).toFixed(2),
    commentRate: ((post.commentCount / views) * 100).toFixed(2),
    shareRate: ((post.shareCount / views) * 100).toFixed(2),
    saveRate: ((post.saveCount / views) * 100).toFixed(2)
  }
}

/**
 * Format time difference in human-readable format
 */
function formatTimeDifference(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

/**
 * Format number with commas and abbreviations
 */
function formatNumber(num: number | bigint): string {
  const n = Number(num)
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

/**
 * Build analysis context from posts
 */
export async function buildAnalysisContext(posts: PostAnalysisData[]): Promise<string> {
  if (posts.length === 0) {
    throw new Error('No posts provided for analysis')
  }

  const contextParts: string[] = []

  // System instruction
  contextParts.push(
    'You are an expert TikTok content analyst with deep knowledge of viral content patterns, engagement optimization, and social media trends.',
    '',
    `Context: You are analyzing ${posts.length} TikTok photo carousel post${posts.length > 1 ? 's' : ''}.`,
    'These posts have been OCR-processed to extract text from each slide, and AI-generated visual descriptions are available.',
    '',
    '=== POSTS DATA ===',
    ''
  )

  // Add each post's data
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    const rates = calculateEngagementRates(post)

    contextParts.push(`Post #${i + 1}:`)
    contextParts.push(`- Author: @${post.authorHandle}${post.authorNickname ? ` (${post.authorNickname})` : ''}`)
    contextParts.push(`- Published: ${post.publishedAt.toLocaleDateString()} (${formatTimeDifference(post.publishedAt)})`)
    contextParts.push(`- Content: ${post.slideCount} slide photo carousel`)
    contextParts.push(`- Engagement: ${formatNumber(post.viewCount)} views | ${formatNumber(post.likeCount)} likes | ${formatNumber(post.commentCount)} comments | ${formatNumber(post.shareCount)} shares | ${formatNumber(post.saveCount)} saves`)
    contextParts.push(`- Engagement Rates: ${rates.likeRate}% like rate | ${rates.commentRate}% comment rate | ${rates.shareRate}% share rate | ${rates.saveRate}% save rate`)

    // Add hashtags if available
    const hashtags = typeof post.hashtags === 'string'
      ? JSON.parse(post.hashtags || '[]')
      : Array.isArray(post.hashtags) ? post.hashtags : []

    if (hashtags.length > 0) {
      const hashtagTexts = hashtags.map((h: any) => h.text || h).join(', ')
      contextParts.push(`- Hashtags: ${hashtagTexts}`)
    }

    // Add description if available
    if (post.description) {
      contextParts.push(`- Description: "${post.description}"`)
    }

    // Add OCR texts
    const ocrTexts = typeof post.ocrTexts === 'string'
      ? JSON.parse(post.ocrTexts || '[]')
      : Array.isArray(post.ocrTexts) ? post.ocrTexts : []

    if (ocrTexts.length > 0) {
      contextParts.push('- Slide Texts (OCR):')
      ocrTexts.forEach((ocr: any) => {
        if (ocr.text && ocr.text.trim()) {
          contextParts.push(`  Slide ${ocr.imageIndex + 1}: "${ocr.text.trim()}"`)
        }
      })
    }

    // Add image descriptions
    const imageDescriptions = typeof post.imageDescriptions === 'string'
      ? JSON.parse(post.imageDescriptions || '[]')
      : Array.isArray(post.imageDescriptions) ? post.imageDescriptions : []

    if (imageDescriptions.length > 0) {
      contextParts.push('- Visual Descriptions:')
      imageDescriptions.forEach((desc: any) => {
        if (desc.imageDescription && desc.imageDescription.trim()) {
          contextParts.push(`  Slide ${desc.imageIndex + 1}: ${desc.imageDescription.trim()}`)
        }
      })
    }

    contextParts.push('') // Empty line between posts
  }

  contextParts.push('=== END POSTS DATA ===')
  contextParts.push('')
  contextParts.push('Instructions:')
  contextParts.push('- Provide actionable insights based on the data above')
  contextParts.push('- Be specific and reference actual content from the posts')
  contextParts.push('- Focus on patterns, trends, and what works')
  contextParts.push('- Use clear formatting with bullet points and headers')
  contextParts.push('- Be concise but comprehensive')
  contextParts.push('')
  contextParts.push('User Query:')

  return contextParts.join('\n')
}

/**
 * Build conversation history for context
 */
export function buildConversationHistory(messages: Message[]): string {
  if (messages.length === 0) return ''

  const historyParts: string[] = ['Previous conversation:']
  
  messages.forEach(msg => {
    if (msg.role === 'user') {
      historyParts.push(`User: ${msg.content}`)
    } else {
      historyParts.push(`Assistant: ${msg.content}`)
    }
  })

  historyParts.push('')
  return historyParts.join('\n')
}
