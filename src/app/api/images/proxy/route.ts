import { NextRequest, NextResponse } from 'next/server'
import heicConvert from 'heic-convert'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }

    // Validate that it's a TikTok CDN URL for security
    const allowedDomains = [
      'tiktokcdn.com',
      'tiktokcdn-us.com',
      'bytedance.com'
    ]

    const urlObj = new URL(imageUrl)
    const isAllowedDomain = allowedDomains.some(domain =>
      urlObj.hostname.includes(domain)
    )

    if (!isAllowedDomain) {
      return NextResponse.json(
        { error: 'URL not from allowed domain' },
        { status: 400 }
      )
    }

    // Fetch the image with user agent to avoid blocks
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'image/*,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    let buffer = Buffer.from(await response.arrayBuffer())

    // Convert HEIC to JPEG if needed (fallback for uncached images)
    if (imageUrl.toLowerCase().includes('.heic') || contentType.includes('heic') || contentType.includes('heif')) {
      try {
        console.log('🔄 Converting HEIC image to JPEG...')
        const convertedBuffer = await heicConvert({
          buffer,
          format: 'JPEG',
          quality: 0.92
        })
        buffer = Buffer.from(convertedBuffer)

        // Return the converted image with proper headers
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Disposition': 'inline', // Force inline display
            'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
            'Cross-Origin-Resource-Policy': 'cross-origin'
          }
        })
      } catch (conversionError) {
        console.error('HEIC conversion failed:', conversionError)
        // Fall back to original image if conversion fails
      }
    }

    // Return the original image with proper headers to force inline display
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline', // Force inline display instead of download
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Cross-Origin-Resource-Policy': 'cross-origin'
      }
    })

  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    )
  }
}