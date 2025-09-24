import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const variations = await prisma.carouselVariation.findMany({
      where: {
        carouselId: id
      },
      include: {
        slides: {
          include: {
            textBoxes: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: [
        { isOriginal: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json(variations)
  } catch (error) {
    console.error('Failed to fetch variations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variations' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, generationType, sourceVariationId } = body

    // If duplicating/rephrasing, get the source variation
    let sourceVariation = null
    if (sourceVariationId) {
      sourceVariation = await prisma.carouselVariation.findUnique({
        where: { id: sourceVariationId },
        include: {
          slides: {
            include: {
              textBoxes: true
            },
            orderBy: { displayOrder: 'asc' }
          }
        }
      })
    }

    // Create new variation
    const variation = await prisma.carouselVariation.create({
      data: {
        carouselId: id,
        name,
        description,
        generationType,
        isOriginal: false
      }
    })

    // If duplicating, copy slides and text boxes
    if (sourceVariation) {
      for (const slide of sourceVariation.slides) {
        const newSlide = await prisma.carouselSlide.create({
          data: {
            variationId: variation.id,
            backgroundImageUrl: slide.backgroundImageUrl,
            backgroundImagePositionX: slide.backgroundImagePositionX,
            backgroundImagePositionY: slide.backgroundImagePositionY,
            backgroundImageZoom: slide.backgroundImageZoom,
            displayOrder: slide.displayOrder
          }
        })

        // Copy text boxes
        for (const textBox of slide.textBoxes) {
          await prisma.carouselTextBox.create({
            data: {
              slideId: newSlide.id,
              text: textBox.text,
              x: textBox.x,
              y: textBox.y,
              width: textBox.width,
              height: textBox.height,
              fontSize: textBox.fontSize,
              fontFamily: textBox.fontFamily,
              fontWeight: textBox.fontWeight,
              fontStyle: textBox.fontStyle,
              textDecoration: textBox.textDecoration,
              color: textBox.color,
              textAlign: textBox.textAlign,
              zIndex: textBox.zIndex
            }
          })
        }
      }
    }

    // Fetch complete variation with slides
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
    console.error('Failed to create variation:', error)
    return NextResponse.json(
      { error: 'Failed to create variation' },
      { status: 500 }
    )
  }
}