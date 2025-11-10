import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * GET /api/content-ideas/library
 * Browse classified slides with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const type = searchParams.get('type') as 'HOOK' | 'CONTENT' | 'CTA' | null
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    const where: any = {}

    if (type) {
      where.type = type
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.contentText = {
        contains: search,
        mode: 'insensitive'
      }
    }

    const [slides, total] = await Promise.all([
      prisma.slideClassificationIndex.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              description: true
            }
          },
          remixPost: {
            select: {
              id: true,
              name: true,
              sourcePostIds: true,
              languageStyleTags: true
            }
          }
        }
      }),
      prisma.slideClassificationIndex.count({ where })
    ])

    return NextResponse.json({
      slides,
      total,
      page,
      limit,
      hasMore: skip + slides.length < total
    })
  } catch (error) {
    console.error('Failed to fetch library:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch library',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
