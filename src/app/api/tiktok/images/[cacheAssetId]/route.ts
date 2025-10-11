import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CacheStatus } from '@/generated/prisma'
import { generatePresignedUrlFromKey, keyToUrl } from '@/lib/r2'

/**
 * GET /api/tiktok/images/[cacheAssetId]
 * Public image proxy for TikTok URL verification
 *
 * This endpoint serves as a verified URL source for TikTok's PULL_FROM_URL feature.
 * Images are fetched from R2 or original source and proxied through this endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cacheAssetId: string }> }
) {
  try {
    const { cacheAssetId } = await params

    // Get cache asset
    const cacheAsset = await prisma.cacheAsset.findUnique({
      where: { id: cacheAssetId },
    })

    if (!cacheAsset) {
      return new NextResponse('Image not found', { status: 404 })
    }

    let imageUrl: string

    // If cached, get from R2
    if (cacheAsset.status === CacheStatus.CACHED && cacheAsset.cacheKey) {
      try {
        // Try presigned URL first
        imageUrl = await generatePresignedUrlFromKey(cacheAsset.cacheKey)
      } catch (error) {
        console.error('Failed to generate presigned URL, using public URL:', error)
        imageUrl = keyToUrl(cacheAsset.cacheKey)
      }
    } else {
      // Use original URL
      imageUrl = cacheAsset.originalUrl
    }

    // Fetch the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'TikTok-Image-Proxy/1.0',
      },
    })

    if (!imageResponse.ok) {
      console.error('Failed to fetch image from source:', imageResponse.status)
      return new NextResponse('Failed to fetch image', { status: 502 })
    }

    // Get image data
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    // Return image with appropriate headers for TikTok
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return new NextResponse(
      'Internal server error',
      { status: 500 }
    )
  }
}

/**
 * HEAD /api/tiktok/images/[cacheAssetId]
 * Support HEAD requests for TikTok verification
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ cacheAssetId: string }> }
) {
  try {
    const { cacheAssetId } = await params

    const cacheAsset = await prisma.cacheAsset.findUnique({
      where: { id: cacheAssetId },
    })

    if (!cacheAsset) {
      return new NextResponse(null, { status: 404 })
    }

    // Return headers only
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': cacheAsset.contentType || 'image/jpeg',
        'Content-Length': (cacheAsset.fileSize || 0).toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    })
  } catch (error) {
    console.error('Image proxy HEAD error:', error)
    return new NextResponse(null, { status: 500 })
  }
}

/**
 * OPTIONS /api/tiktok/images/[cacheAssetId]
 * Support CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
