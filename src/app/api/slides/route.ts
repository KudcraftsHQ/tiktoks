import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    
    const skip = (page - 1) * limit

    // Build where clause for filtering non-original slides
    const whereConditions: any[] = [
      {
        variation: {
          isOriginal: false
        }
      }
    ]

    // Search condition
    if (search) {
      whereConditions.push({
        OR: [
          {
            variation: {
              name: {
                contains: search,
                mode: 'insensitive' as const
              }
            }
          },
          {
            variation: {
              carousel: {
                title: {
                  contains: search,
                  mode: 'insensitive' as const
                }
              }
            }
          },
          {
            variation: {
              carousel: {
                author: {
                  contains: search,
                  mode: 'insensitive' as const
                }
              }
            }
          },
          {
            textBoxes: {
              some: {
                text: {
                  contains: search,
                  mode: 'insensitive' as const
                }
              }
            }
          }
        ]
      })
    }

    const where = whereConditions.length > 1 ? { AND: whereConditions } : whereConditions[0]

    const [slides, total] = await Promise.all([
      prisma.carouselSlide.findMany({
        where,
        include: {
          variation: {
            select: {
              id: true,
              name: true,
              description: true,
              carousel: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                  authorHandle: true
                }
              }
            }
          },
          textBoxes: {
            orderBy: {
              zIndex: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.carouselSlide.count({ where })
    ])

    const hasMore = skip + limit < total

    return NextResponse.json({
      slides,
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch slides:', error)
    return NextResponse.json(
      { error: 'Failed to fetch slides' },
      { status: 500 }
    )
  }
}