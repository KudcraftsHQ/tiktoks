import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { parseTikTokUrl } from '@/lib/tiktok-url-parser'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const approved = searchParams.get('approved') // 'true', 'false', or 'all'
    const sortBy = searchParams.get('sortBy') || 'createdAt' // 'createdAt', 'updatedAt', 'postedAt'
    const order = searchParams.get('order') || 'desc' // 'asc' or 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {
      bookmarked: true
    }

    if (approved === 'true') {
      where.approved = true
    } else if (approved === 'false') {
      where.approved = false
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch bookmarked remixes with all related data
    const remixes = await prisma.remixPost.findMany({
      where,
      include: {
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        },
        originalPost: {
          include: {
            profile: {
              select: {
                id: true,
                handle: true,
                nickname: true,
                isOwnProfile: true
              }
            }
          }
        }
      },
      orderBy: {
        [sortBy]: order
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.remixPost.count({ where })

    // Enrich remixes with linked post stats
    const enrichedRemixes = await Promise.all(
      remixes.map(async (remix) => {
        let linkedPostStats = null

        // If postedUrl is set, try to find matching post
        if (remix.postedUrl) {
          const parsedUrl = parseTikTokUrl(remix.postedUrl)

          // Try to find matching post by URL or video ID
          const whereClause: any = {
            OR: [
              { tiktokUrl: parsedUrl.normalizedUrl },
              { tiktokUrl: remix.postedUrl }
            ]
          }

          if (parsedUrl.videoId) {
            whereClause.OR.push({ tiktokId: parsedUrl.videoId })
          }

          const linkedPost = await prisma.tiktokPost.findFirst({
            where: whereClause,
            include: {
              profile: {
                select: {
                  id: true,
                  handle: true,
                  nickname: true,
                  isOwnProfile: true
                }
              },
              metricsHistory: {
                orderBy: { recordedAt: 'desc' },
                take: 30,
                select: {
                  viewCount: true,
                  likeCount: true,
                  shareCount: true,
                  commentCount: true,
                  saveCount: true,
                  recordedAt: true
                }
              }
            }
          })

          // Only include stats if it's an own profile post
          if (linkedPost && linkedPost.profile.isOwnProfile) {
            linkedPostStats = {
              id: linkedPost.id,
              tiktokUrl: linkedPost.tiktokUrl,
              viewCount: linkedPost.viewCount?.toString() || '0',
              likeCount: linkedPost.likeCount || 0,
              shareCount: linkedPost.shareCount || 0,
              commentCount: linkedPost.commentCount || 0,
              saveCount: linkedPost.saveCount || 0,
              publishedAt: linkedPost.publishedAt,
              profile: linkedPost.profile,
              metricsHistory: linkedPost.metricsHistory.map(m => ({
                viewCount: m.viewCount?.toString() || '0',
                likeCount: m.likeCount || 0,
                shareCount: m.shareCount || 0,
                commentCount: m.commentCount || 0,
                saveCount: m.saveCount || 0,
                recordedAt: m.recordedAt
              }))
            }
          }
        }

        // Parse slides from JSON
        const slides = Array.isArray(remix.slides) ? remix.slides : JSON.parse(remix.slides as string)

        return {
          id: remix.id,
          name: remix.name,
          description: remix.description,
          generationType: remix.generationType,
          bookmarked: remix.bookmarked,
          approved: remix.approved,
          postedUrl: remix.postedUrl,
          postedAt: remix.postedAt,
          createdAt: remix.createdAt,
          updatedAt: remix.updatedAt,
          slideCount: slides.length,
          productContext: remix.productContext,
          originalPost: remix.originalPost ? {
            id: remix.originalPost.id,
            tiktokUrl: remix.originalPost.tiktokUrl,
            authorNickname: remix.originalPost.authorNickname,
            authorHandle: remix.originalPost.authorHandle,
            contentType: remix.originalPost.contentType,
            viewCount: remix.originalPost.viewCount?.toString() || '0',
            likeCount: remix.originalPost.likeCount || 0,
            shareCount: remix.originalPost.shareCount || 0,
            commentCount: remix.originalPost.commentCount || 0,
            saveCount: remix.originalPost.saveCount || 0,
            ocrTexts: remix.originalPost.ocrTexts,
            profile: remix.originalPost.profile
          } : null,
          linkedPostStats,
          slides: slides.map((slide: any, index: number) => ({
            id: slide.id,
            displayOrder: index,
            paraphrasedText: slide.paraphrasedText || '',
            textBoxes: (slide.textBoxes || []).map((tb: any) => ({
              id: tb.id,
              text: tb.text
            }))
          }))
        }
      })
    )

    return NextResponse.json({
      remixes: enrichedRemixes,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    })
  } catch (error) {
    console.error('Failed to fetch bookmarked remixes:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch bookmarked remixes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
