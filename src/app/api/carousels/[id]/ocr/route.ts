import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { imageId } = await request.json()

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }

    // Verify the image belongs to the carousel
    const image = await prisma.carouselImage.findFirst({
      where: {
        id: imageId,
        carouselId: resolvedParams.id
      }
    })

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Import OCR service
    const { performOCR } = await import('@/lib/ocr-service')
    
    // Perform OCR
    const text = await performOCR(image.imageUrl)

    // Update the image with OCR text
    const updatedImage = await prisma.carouselImage.update({
      where: { id: imageId },
      data: { text }
    })

    return NextResponse.json({
      success: true,
      text,
      imageId: updatedImage.id
    })
  } catch (error) {
    console.error('Failed to perform OCR:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform OCR' },
      { status: 500 }
    )
  }
}