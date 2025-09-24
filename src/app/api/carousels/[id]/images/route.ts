import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { imageTexts } = await request.json()

    if (!imageTexts || typeof imageTexts !== 'object') {
      return NextResponse.json(
        { error: 'Invalid imageTexts data' },
        { status: 400 }
      )
    }

    // Verify carousel exists
    const carousel = await prisma.carousel.findUnique({
      where: { id: resolvedParams.id },
      include: { images: true }
    })

    if (!carousel) {
      return NextResponse.json(
        { error: 'Carousel not found' },
        { status: 404 }
      )
    }

    // Update each image's text
    const updatePromises = Object.entries(imageTexts).map(([imageId, text]) => {
      // Verify image belongs to this carousel
      const imageExists = carousel.images.some(img => img.id === imageId)
      if (!imageExists) {
        return null
      }

      return prisma.carouselImage.update({
        where: { id: imageId },
        data: { text: text as string || null }
      })
    }).filter(Boolean)

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating image texts:', error)
    return NextResponse.json(
      { error: 'Failed to update image texts' },
      { status: 500 }
    )
  }
}