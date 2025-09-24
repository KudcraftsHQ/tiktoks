import { NextRequest, NextResponse } from 'next/server'
import { cacheAssetService } from '@/lib/cache-asset-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const originalUrl = searchParams.get('url')

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }

    // Check if we have a cached version
    const cacheAsset = await cacheAssetService.getCacheAssetByUrl(originalUrl)

    if (cacheAsset) {
      // Get the best available URL (R2 cached URL or fallback to original)
      const resolvedUrl = await cacheAssetService.getUrl(cacheAsset.id, originalUrl)

      return NextResponse.json({
        cached: true,
        status: cacheAsset.status,
        resolvedUrl,
        cacheAsset: {
          id: cacheAsset.id,
          status: cacheAsset.status,
          cacheKey: cacheAsset.cacheKey,
          contentType: cacheAsset.contentType,
          cachedAt: cacheAsset.cachedAt
        }
      })
    }

    return NextResponse.json({
      cached: false,
      resolvedUrl: originalUrl
    })

  } catch (error) {
    console.error('Failed to check cached image:', error)
    return NextResponse.json(
      { error: 'Failed to check cached image' },
      { status: 500 }
    )
  }
}