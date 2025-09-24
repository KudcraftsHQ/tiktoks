import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    
    // Filter parameters
    const authors = searchParams.get('authors')?.split(',').filter(Boolean) || []
    const dateRange = searchParams.get('dateRange') || 'all'
    const customDateStart = searchParams.get('customDateStart')
    const customDateEnd = searchParams.get('customDateEnd')
    const imageCountMin = searchParams.get('imageCountMin')
    const imageCountMax = searchParams.get('imageCountMax')
    const sortBy = searchParams.get('sortBy') || 'newest'

    const skip = (page - 1) * limit

    // Build where clause
    const whereConditions: any[] = []

    // Search condition
    if (search) {
      whereConditions.push({
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive' as const
            }
          },
          {
            description: {
              contains: search,
              mode: 'insensitive' as const
            }
          },
          {
            author: {
              contains: search,
              mode: 'insensitive' as const
            }
          },
          {
            authorHandle: {
              contains: search,
              mode: 'insensitive' as const
            }
          },
          {
            images: {
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

    // Author filter
    if (authors.length > 0) {
      whereConditions.push({
        author: {
          in: authors
        }
      })
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      let startDate: Date | undefined

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case 'custom':
          if (customDateStart || customDateEnd) {
            const dateCondition: any = {}
            if (customDateStart) {
              dateCondition.gte = new Date(customDateStart)
            }
            if (customDateEnd) {
              const endDate = new Date(customDateEnd)
              endDate.setHours(23, 59, 59, 999) // End of day
              dateCondition.lte = endDate
            }
            if (Object.keys(dateCondition).length > 0) {
              whereConditions.push({
                createdAt: dateCondition
              })
            }
          }
          break
        default:
          break
      }

      if (dateRange !== 'custom' && startDate) {
        whereConditions.push({
          createdAt: {
            gte: startDate
          }
        })
      }
    }

    // Image count filter
    if (imageCountMin || imageCountMax) {
      const imageCountCondition: any = {}
      if (imageCountMin) {
        imageCountCondition._count = { gte: parseInt(imageCountMin) }
      }
      if (imageCountMax) {
        imageCountCondition._count = { 
          ...(imageCountCondition._count || {}),
          lte: parseInt(imageCountMax) 
        }
      }
      
      // This requires a more complex query with having clause
      // For now, we'll filter in-memory after the query
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {}

    // Build orderBy clause
    let orderBy: any
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      case 'author-az':
        orderBy = { author: 'asc' }
        break
      case 'author-za':
        orderBy = { author: 'desc' }
        break
      case 'most-images':
        orderBy = { images: { _count: 'desc' } }
        break
      case 'least-images':
        orderBy = { images: { _count: 'asc' } }
        break
      default: // 'newest'
        orderBy = { createdAt: 'desc' }
    }

    const [carousels, total] = await Promise.all([
      prisma.carousel.findMany({
        where,
        include: {
          images: {
            orderBy: {
              displayOrder: 'asc'
            }
          },
          _count: {
            select: {
              images: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.carousel.count({ where })
    ])

    // Apply image count filter in-memory if needed
    let filteredCarousels = carousels
    if (imageCountMin || imageCountMax) {
      filteredCarousels = carousels.filter(carousel => {
        const imageCount = carousel.images.length
        if (imageCountMin && imageCount < parseInt(imageCountMin)) return false
        if (imageCountMax && imageCount > parseInt(imageCountMax)) return false
        return true
      })
    }

    // Generate presigned URLs for all media
    console.log(`🔗 [API] Generating presigned URLs for ${filteredCarousels.length} carousels`)

    const carouselsWithPresignedUrls = await Promise.all(
      filteredCarousels.map(async (carousel, index) => {
        console.log(`🔄 [API] Processing carousel ${index + 1}/${filteredCarousels.length}:`, {
          carouselId: carousel.id,
          imageCount: carousel.images.length,
          hasAuthorAvatar: !!carousel.authorAvatar,
          hasAuthorAvatarId: !!carousel.authorAvatarId
        })

        // Generate presigned URLs for images
        const imageIds = carousel.images.map(img => img.imageId)

        console.log(`🖼️ [API] Image IDs for carousel ${carousel.id}:`, imageIds)

        const presignedImageUrls = await cacheAssetService.getUrls(imageIds)

        const imagesWithPresignedUrls = carousel.images.map((img, index) => ({
          ...img,
          imageUrl: presignedImageUrls[index]
        }))

        console.log(`✅ [API] Images processed for carousel ${carousel.id}:`, {
          originalCount: carousel.images.length,
          processedCount: imagesWithPresignedUrls.length,
          firstImageUrl: imagesWithPresignedUrls[0]?.imageUrl
        })

        // Generate presigned URL for author avatar
        const authorAvatarUrl = await cacheAssetService.getUrl(carousel.authorAvatarId)

        console.log(`👤 [API] Author avatar processed for carousel ${carousel.id}:`, {
          authorAvatarId: carousel.authorAvatarId,
          finalAvatarUrl: authorAvatarUrl
        })

        return {
          ...carousel,
          authorAvatar: authorAvatarUrl,
          images: imagesWithPresignedUrls
        }
      })
    )

    console.log(`✅ [API] All carousels processed with presigned URLs`)

    const hasMore = skip + limit < total

    return NextResponse.json({
      carousels: carouselsWithPresignedUrls,
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch carousels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch carousels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Check if carousel already exists
    const existingCarousel = await prisma.carousel.findUnique({
      where: { tiktokUrl: url }
    })

    if (existingCarousel) {
      return NextResponse.json(
        { error: 'Carousel already exists' },
        { status: 400 }
      )
    }

    // Import scraping service
    const { scrapeCarousel } = await import('@/lib/scraping-service')
    
    // Scrape the carousel
    const scrapedData = await scrapeCarousel(url)

    // Create carousel with images in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const carousel = await tx.carousel.create({
        data: {
          tiktokUrl: url,
          title: scrapedData.title,
          description: scrapedData.description,
          author: scrapedData.author,
          authorHandle: scrapedData.authorHandle,
          authorAvatarId: scrapedData.authorAvatarId,
          tags: JSON.stringify(scrapedData.tags),
          viewCount: scrapedData.viewCount,
          likeCount: scrapedData.likeCount,
          shareCount: scrapedData.shareCount,
          saveCount: scrapedData.saveCount,
          commentCount: scrapedData.commentCount
        }
      })

      const images = await tx.carouselImage.createMany({
        data: scrapedData.images.map((image: any, index: number) => ({
          carouselId: carousel.id,
          imageUrl: image.imageUrl,
          imageKey: image.imageKey,
          width: image.width,
          height: image.height,
          displayOrder: index
        }))
      })

      return { carousel, images }
    })

    return NextResponse.json(result.carousel, { status: 201 })
  } catch (error) {
    console.error('Failed to create carousel:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create carousel' },
      { status: 500 }
    )
  }
}