import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    // Get all images for the carousel
    const images = await prisma.carouselImage.findMany({
      where: { carouselId: resolvedParams.id },
      orderBy: { displayOrder: 'asc' }
    })

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images found for this carousel' },
        { status: 404 }
      )
    }

    // Import OCR service
    const { performOCR } = await import('@/lib/ocr-service')
    
    // Perform OCR on all images
    const results = await Promise.allSettled(
      images.map(async (image) => {
        try {
          const text = await performOCR(image.imageUrl)
          return { imageId: image.id, text, success: true }
        } catch (error) {
          console.error(`OCR failed for image ${image.id}:`, error)
          return { imageId: image.id, error: error instanceof Error ? error.message : 'Unknown error', success: false }
        }
      })
    )

    // Update successful OCR results
    const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value.success)
    
    await Promise.all(
      successfulResults.map((result: any) => 
        prisma.carouselImage.update({
          where: { id: result.value.imageId },
          data: { text: result.value.text }
        })
      )
    )

    const successful = successfulResults.length
    const failed = images.length - successful

    return NextResponse.json({
      success: true,
      message: `OCR completed for ${successful} images, ${failed} failed`,
      results: results.map((r: any) => r.status === 'fulfilled' ? r.value : r.reason)
    })
  } catch (error) {
    console.error('Failed to perform batch OCR:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform batch OCR' },
      { status: 500 }
    )
  }
}