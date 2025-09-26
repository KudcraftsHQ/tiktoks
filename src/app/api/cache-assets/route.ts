import { NextRequest, NextResponse } from 'next/server'
import { cacheAssetService } from '@/lib/cache-asset-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { originalUrl, folder = 'media', filename } = body

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'originalUrl is required' },
        { status: 400 }
      )
    }

    console.log('🚀 [Cache Assets API] Creating cache asset for:', originalUrl)

    const cacheAsset = await cacheAssetService.createCacheAsset(
      originalUrl,
      folder,
      filename
    )

    return NextResponse.json({
      success: true,
      cacheAssetId: cacheAsset.id,
      status: cacheAsset.status
    })
  } catch (error) {
    console.error('💥 [Cache Assets API] Error creating cache asset:', error)
    return NextResponse.json(
      { error: 'Failed to create cache asset' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cacheAssetId = searchParams.get('id')

    if (!cacheAssetId) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      )
    }

    console.log('🔍 [Cache Assets API] Getting URL for cache asset:', cacheAssetId)

    const url = await cacheAssetService.getUrl(cacheAssetId)

    return NextResponse.json({
      success: true,
      url
    })
  } catch (error) {
    console.error('💥 [Cache Assets API] Error getting cache asset URL:', error)
    return NextResponse.json(
      { error: 'Failed to get cache asset URL' },
      { status: 500 }
    )
  }
}