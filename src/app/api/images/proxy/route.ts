import { NextRequest, NextResponse } from 'next/server'
import heicConvert from 'heic-convert'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    const cacheAssetId = searchParams.get('id')

    // Support both URL-based and ID-based proxy
    let finalImageUrl: string

    if (cacheAssetId) {
      // ID-based proxy: Look up cache asset and get the best URL
      try {
        const resolvedUrl = await cacheAssetService.getUrl(cacheAssetId)
        if (!resolvedUrl) {
          return NextResponse.json(
            { error: 'Cache asset not found' },
            { status: 404 }
          )
        }
        finalImageUrl = resolvedUrl
      } catch (error) {
        console.error('Failed to resolve cache asset:', error)
        return NextResponse.json(
          { error: 'Failed to resolve cache asset' },
          { status: 500 }
        )
      }
    } else if (imageUrl) {
      // Legacy URL-based proxy
      finalImageUrl = imageUrl
    } else {
      return NextResponse.json(
        { error: 'Missing url or id parameter' },
        { status: 400 }
      )
    }

    // Validate that it's a TikTok CDN URL, R2 URL, or presigned URL for security
    const allowedDomains = [
      'tiktokcdn.com',
      'tiktokcdn-us.com',
      'bytedance.com',
      'r2.dev',
      'r2.cloudflarestorage.com'
    ]

    const urlObj = new URL(finalImageUrl)
    const isAllowedDomain = allowedDomains.some(domain =>
      urlObj.hostname.includes(domain)
    )

    // Also check if it's a presigned URL (has signature params)
    const isPresignedUrl = finalImageUrl.includes('X-Amz-Signature') ||
                           finalImageUrl.includes('x-amz-signature') ||
                           finalImageUrl.includes('Signature=')

    if (!isAllowedDomain && !isPresignedUrl) {
      return NextResponse.json(
        { error: 'URL not from allowed domain' },
        { status: 400 }
      )
    }

    // Always proxy through the server (no redirect optimization)
    // This ensures:
    // 1. Stable proxy URLs
    // 2. Proper CORS headers
    // 3. HEIC conversion on-the-fly when R2 cache isn't ready yet
    // 4. Guaranteed JPEG output

    // Fetch the image with user agent to avoid blocks
    const response = await fetch(finalImageUrl, {
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

    // Only convert if it's ACTUALLY a HEIC file (check content-type, not just URL)
    // Note: Files may have .heic extension but already be JPEG (from MediaCacheWorker)
    const isActuallyHeic = contentType.includes('heic') || contentType.includes('heif')

    if (isActuallyHeic) {
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
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
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
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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