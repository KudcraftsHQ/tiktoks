import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { renderSlideToCanvas } from '@/lib/canvas-renderer'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const { variationId } = await params
    const body = await request.json()
    const { slideIndex = 0, format = 'png', quality = 0.95 } = body

    // Fetch variation with slides and textboxes
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

    if (slideIndex >= variation.slides.length) {
      return NextResponse.json(
        { error: 'Slide not found' },
        { status: 404 }
      )
    }

    const slide = variation.slides[slideIndex]
    
    // Generate image using canvas renderer
    const imageBuffer = await renderSlideToCanvas(slide, { format, quality })
    
    const filename = `${variation.name.replace(/[^a-zA-Z0-9]/g, '_')}-slide-${slideIndex + 1}.${format}`
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Export failed:', error)
    return NextResponse.json(
      { error: 'Failed to export slide' },
      { status: 500 }
    )
  }
}