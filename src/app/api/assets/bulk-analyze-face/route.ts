import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { detectFacesForAssets } from '@/lib/face-detection-service'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assetIds } = body as { assetIds: string[] }

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'assetIds array is required' },
        { status: 400 }
      )
    }

    // Verify all assets exist
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } }
    })

    if (assets.length !== assetIds.length) {
      return NextResponse.json(
        { error: 'Some assets were not found' },
        { status: 404 }
      )
    }

    // Perform face detection for all assets
    const results = await detectFacesForAssets(assetIds)

    // Get updated assets with URLs
    const updatedAssets = await prisma.asset.findMany({
      where: { id: { in: assetIds } }
    })

    const cacheAssetIds = updatedAssets.map(a => a.cacheAssetId)
    const urls = await cacheAssetService.getUrls(cacheAssetIds)

    const assetsWithUrls = updatedAssets.map((asset, index) => ({
      ...asset,
      url: urls[index]
    }))

    return NextResponse.json({
      success: true,
      processed: results.size,
      assets: assetsWithUrls
    })
  } catch (error) {
    console.error('Failed to bulk analyze faces:', error)
    return NextResponse.json(
      { error: 'Failed to bulk analyze faces' },
      { status: 500 }
    )
  }
}
