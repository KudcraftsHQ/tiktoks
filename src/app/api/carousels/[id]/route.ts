import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const carousel = await prisma.carousel.findUnique({
      where: { id: resolvedParams.id },
      include: {
        images: {
          orderBy: {
            displayOrder: 'asc'
          }
        }
      }
    })

    if (!carousel) {
      return NextResponse.json(
        { error: 'Carousel not found' },
        { status: 404 }
      )
    }

    // Generate presigned URLs for images
    console.log(`🔗 [API] Generating presigned URLs for carousel ${carousel.id}`)
    console.log(`🖼️ [API] Carousel has ${carousel.images.length} images`)

    const imageIds = carousel.images.map(img => img.imageId)

    console.log(`🖼️ [API] Image IDs:`, imageIds)

    const presignedImageUrls = await cacheAssetService.getUrls(imageIds)

    const imagesWithPresignedUrls = carousel.images.map((img, index) => ({
      ...img,
      imageUrl: presignedImageUrls[index]
    }))

    console.log(`✅ [API] Images processed:`, {
      originalCount: carousel.images.length,
      processedCount: imagesWithPresignedUrls.length,
      firstImageUrl: imagesWithPresignedUrls[0]?.imageUrl
    })

    // Generate presigned URL for author avatar
    console.log(`👤 [API] Author avatar ID:`, carousel.authorAvatarId)

    const authorAvatarUrl = await cacheAssetService.getUrl(carousel.authorAvatarId)

    console.log(`✅ [API] Author avatar processed:`, {
      finalAvatarUrl: authorAvatarUrl
    })

    const carouselWithPresignedUrls = {
      ...carousel,
      authorAvatar: authorAvatarUrl,
      images: imagesWithPresignedUrls
    }

    return NextResponse.json(carouselWithPresignedUrls)
  } catch (error) {
    console.error('Failed to fetch carousel:', error)
    return NextResponse.json(
      { error: 'Failed to fetch carousel' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await prisma.carousel.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete carousel:', error)
    return NextResponse.json(
      { error: 'Failed to delete carousel' },
      { status: 500 }
    )
  }
}