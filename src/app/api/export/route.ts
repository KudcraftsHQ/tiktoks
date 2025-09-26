import { NextRequest, NextResponse } from 'next/server'
import { exportSlideAsImage, exportSlidesAsZip } from '@/lib/canvas-export'
import type { RemixSlideType } from '@/lib/validations/remix-schema'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slides, backgroundImageUrls, format = 'png', quality = 0.95 } = body

    if (!slides || !Array.isArray(slides)) {
      return NextResponse.json(
        { error: 'Invalid slides data' },
        { status: 400 }
      )
    }

    if (!backgroundImageUrls || typeof backgroundImageUrls !== 'object') {
      return NextResponse.json(
        { error: 'Invalid background image URLs' },
        { status: 400 }
      )
    }

    // Validate slide data structure
    const validatedSlides: RemixSlideType[] = slides.map(slide => ({
      ...slide,
      canvas: {
        width: slide.canvas?.width || 1080,
        height: slide.canvas?.height || 1920,
        unit: slide.canvas?.unit || 'px'
      },
      backgroundLayers: slide.backgroundLayers || [],
      textBoxes: slide.textBoxes || []
    }))

    if (slides.length === 1) {
      // Export single slide as image
      const dataURL = await exportSlideAsImage(
        validatedSlides[0],
        backgroundImageUrls,
        { format, quality }
      )

      // Convert dataURL to buffer
      const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      // Return as image response
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': `image/${format}`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache'
        }
      })
    } else {
      // Export multiple slides as ZIP
      const zipBlob = await exportSlidesAsZip(
        validatedSlides,
        backgroundImageUrls,
        { format, quality }
      )

      // Return as ZIP response
      return new NextResponse(zipBlob, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': zipBlob.size.toString(),
          'Cache-Control': 'no-cache'
        }
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export slides' },
      { status: 500 }
    )
  }
}