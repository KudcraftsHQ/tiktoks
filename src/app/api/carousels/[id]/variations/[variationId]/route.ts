import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const { variationId } = await params
    const variation = await prisma.carouselVariation.findUnique({
      where: { id: variationId },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    if (!variation) {
      return NextResponse.json(
        { error: 'Variation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(variation)
  } catch (error) {
    console.error('Failed to fetch variation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variation' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const { variationId } = await params
    const body = await request.json()
    const { name, description, slides } = body

    // Update variation details
    await prisma.carouselVariation.update({
      where: { id: variationId },
      data: {
        name,
        description
      }
    })

    // Update slides if provided
    if (slides) {
      // Delete existing slides and their text boxes
      await prisma.carouselSlide.deleteMany({
        where: { variationId: variationId }
      })

      // Create new slides
      for (const slideData of slides) {
        const slide = await prisma.carouselSlide.create({
          data: {
            variationId: variationId,
            backgroundImageUrl: slideData.backgroundImageUrl,
            backgroundImagePositionX: slideData.backgroundImagePositionX || 0.5,
            backgroundImagePositionY: slideData.backgroundImagePositionY || 0.5,
            backgroundImageZoom: slideData.backgroundImageZoom || 1.0,
            displayOrder: slideData.displayOrder
          }
        })

        // Create text boxes for this slide
        if (slideData.textBoxes) {
          for (const textBoxData of slideData.textBoxes) {
            await prisma.carouselTextBox.create({
              data: {
                slideId: slide.id,
                text: textBoxData.text,
                x: textBoxData.x,
                y: textBoxData.y,
                width: textBoxData.width,
                height: textBoxData.height,
                fontSize: textBoxData.fontSize || 24,
                fontFamily: textBoxData.fontFamily || 'Poppins',
                fontWeight: textBoxData.fontWeight || 'normal',
                fontStyle: textBoxData.fontStyle || 'normal',
                textDecoration: textBoxData.textDecoration || 'none',
                color: textBoxData.color || '#000000',
                textAlign: textBoxData.textAlign || 'center',
                zIndex: textBoxData.zIndex || 1
              }
            })
          }
        }
      }
    }

    // Return updated variation
    const updatedVariation = await prisma.carouselVariation.findUnique({
      where: { id: variationId },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    return NextResponse.json(updatedVariation)
  } catch (error) {
    console.error('Failed to update variation:', error)
    return NextResponse.json(
      { error: 'Failed to update variation' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const { variationId } = await params
    // Check if it's the original variation
    const variation = await prisma.carouselVariation.findUnique({
      where: { id: variationId }
    })

    if (!variation) {
      return NextResponse.json(
        { error: 'Variation not found' },
        { status: 404 }
      )
    }

    if (variation.isOriginal) {
      return NextResponse.json(
        { error: 'Cannot delete original variation' },
        { status: 400 }
      )
    }

    await prisma.carouselVariation.delete({
      where: { id: variationId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete variation:', error)
    return NextResponse.json(
      { error: 'Failed to delete variation' },
      { status: 500 }
    )
  }
}