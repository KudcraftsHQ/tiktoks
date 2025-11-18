/**
 * Test API endpoint for Satori export
 * POST /api/test-satori/export
 */

import { NextRequest, NextResponse } from 'next/server'
import { satoriExportService } from '@/lib/satori-export-service'
import type { SlideData } from '@/lib/satori-renderer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slide, options } = body as {
      slide: SlideData
      options?: {
        format?: 'png' | 'jpeg'
        quality?: number
      }
    }

    if (!slide) {
      return NextResponse.json(
        { error: 'Slide data is required' },
        { status: 400 }
      )
    }

    console.log('📥 [API] Export request received')
    console.log('📥 [API] Slide canvas:', slide.canvas)
    console.log('📥 [API] Background layers:', slide.backgroundLayers?.length || 0)
    console.log('📥 [API] Text boxes:', slide.textBoxes?.length || 0)

    // Export slide
    const buffer = await satoriExportService.exportSlide(slide, options)

    console.log('✅ [API] Export successful:', buffer.length, 'bytes')

    // Return image
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': 'attachment; filename="slide.png"',
      },
    })
  } catch (error) {
    console.error('❌ [API] Export failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to export slide',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
