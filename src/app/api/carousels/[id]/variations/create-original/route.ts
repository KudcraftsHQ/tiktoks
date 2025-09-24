import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { imageTexts } = body

    // Check if original variation already exists
    const existingOriginal = await prisma.carouselVariation.findFirst({
      where: {
        carouselId: id,
        isOriginal: true
      }
    })

    if (existingOriginal) {
      return NextResponse.json(existingOriginal)
    }

    // Get carousel with images
    const carousel = await prisma.carousel.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    if (!carousel) {
      return NextResponse.json(
        { error: 'Carousel not found' },
        { status: 404 }
      )
    }

    // Create original variation
    const variation = await prisma.carouselVariation.create({
      data: {
        carouselId: id,
        name: carousel.title || 'Original',
        description: 'Original carousel converted to variation format',
        isOriginal: true,
        generationType: 'original'
      }
    })

    // Convert carousel images to slides with text boxes
    for (const image of carousel.images) {
      const slide = await prisma.carouselSlide.create({
        data: {
          variationId: variation.id,
          backgroundImageUrl: image.imageUrl,
          backgroundImagePositionX: 0.5,
          backgroundImagePositionY: 0.5,
          backgroundImageZoom: 1.0,
          displayOrder: image.displayOrder
        }
      })

      // Create text box from OCR text if available
      const text = imageTexts?.[image.id] || image.text
      if (text && text.trim()) {
        await prisma.carouselTextBox.create({
          data: {
            slideId: slide.id,
            text: text.trim(),
            x: 0.1,
            y: 0.1,
            width: 0.8,
            height: 0.8,
            fontSize: 24,
            fontFamily: 'Poppins',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
            textAlign: 'center',
            zIndex: 1
          }
        })
      }
    }

    // Return complete variation with slides
    const completeVariation = await prisma.carouselVariation.findUnique({
      where: { id: variation.id },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    return NextResponse.json(completeVariation)
  } catch (error) {
    console.error('Failed to create original variation:', error)
    return NextResponse.json(
      { error: 'Failed to create original variation' },
      { status: 500 }
    )
  }
}