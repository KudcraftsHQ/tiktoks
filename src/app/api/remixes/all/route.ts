import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const sortParam = searchParams.get('sort')
    const searchQuery = searchParams.get('search')

    // Build where clause
    const where: any = {}

    // Add search filter
    if (searchQuery && searchQuery.trim().length > 0) {
      const searchLower = searchQuery.toLowerCase()
      where.OR = [
        { name: { contains: searchLower, mode: 'insensitive' } },
        { description: { contains: searchLower, mode: 'insensitive' } }
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Parse sorting
    let orderBy: any[] = []
    if (sortParam) {
      orderBy = sortParam.split(',').map(sort => {
        const [field, direction] = sort.trim().split('.')
        return { [field]: direction === 'asc' ? 'asc' : 'desc' }
      })
    } else {
      // Default sorting
      orderBy = [{ updatedAt: 'desc' }]
    }

    // Fetch drafts with all related data
    const drafts = await prisma.remixPost.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        generationType: true,
        bookmarked: true,
        approved: true,
        createdAt: true,
        updatedAt: true,
        slides: true,
        slideClassifications: true, // JSON field, not a relation
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
                nickname: true
              }
            }
          }
        }
      },
      orderBy,
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.remixPost.count({ where })

    // Transform drafts to match the expected format
    const transformedDrafts = drafts.map(draft => {
      // Parse slides from JSON
      const slides = Array.isArray(draft.slides) ? draft.slides : JSON.parse(draft.slides as string)

      return {
        id: draft.id,
        name: draft.name,
        description: draft.description,
        generationType: draft.generationType,
        bookmarked: draft.bookmarked,
        approved: draft.approved,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        productContext: draft.productContext,
        originalPost: draft.originalPost ? {
          id: draft.originalPost.id,
          tiktokUrl: draft.originalPost.tiktokUrl,
          authorNickname: draft.originalPost.authorNickname,
          authorHandle: draft.originalPost.authorHandle,
          contentType: draft.originalPost.contentType,
          viewCount: draft.originalPost.viewCount?.toString() || '0',
          likeCount: draft.originalPost.likeCount || 0,
          shareCount: draft.originalPost.shareCount || 0,
          commentCount: draft.originalPost.commentCount || 0,
          saveCount: draft.originalPost.saveCount || 0,
          ocrTexts: draft.originalPost.ocrTexts,
          profile: draft.originalPost.profile
        } : null,
        slides,
        slideClassifications: draft.slideClassifications,
        _rowType: 'draft' as const
      }
    })

    return NextResponse.json({
      drafts: transformedDrafts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    })
  } catch (error) {
    console.error('Failed to fetch drafts:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch drafts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
