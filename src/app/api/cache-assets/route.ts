import { NextRequest, NextResponse } from 'next/server'
import { cacheAssetService } from '@/lib/cache-asset-service'
import { PrismaClient } from '@/generated/prisma'
import { deleteFromR2 } from '@/lib/r2'

const prisma = new PrismaClient()

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

    // If id is provided, get single asset URL
    if (cacheAssetId) {
      console.log('🔍 [Cache Assets API] Getting URL for cache asset:', cacheAssetId)
      const url = await cacheAssetService.getUrl(cacheAssetId)
      return NextResponse.json({ success: true, url })
    }

    // Otherwise, list all assets with pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const contentType = searchParams.get('contentType') || ''

    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.originalUrl = { contains: search }
    }

    if (contentType) {
      where.contentType = { startsWith: contentType }
    }

    const [assets, total] = await Promise.all([
      prisma.cacheAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.cacheAsset.count({ where })
    ])

    // Resolve URLs for all assets
    const cacheAssetIds = assets.map(a => a.id)
    const urls = await cacheAssetService.getUrls(cacheAssetIds)

    const assetsWithUrls = assets.map((asset, index) => ({
      ...asset,
      url: urls[index]
    }))

    return NextResponse.json({
      assets: assetsWithUrls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('💥 [Cache Assets API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',') || []

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No asset IDs provided' },
        { status: 400 }
      )
    }

    console.log(`🗑️ [Cache Assets API] Deleting ${ids.length} assets`)

    // Get assets to delete
    const assets = await prisma.cacheAsset.findMany({
      where: { id: { in: ids } }
    })

    // Delete from R2 if cacheKey exists
    const deletePromises = assets
      .filter(asset => asset.cacheKey)
      .map(asset => deleteFromR2(asset.cacheKey!).catch(err => {
        console.error(`Failed to delete R2 object for asset ${asset.id}:`, err)
      }))

    await Promise.all(deletePromises)

    // Delete from database
    await prisma.cacheAsset.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({
      success: true,
      deleted: ids.length
    })
  } catch (error) {
    console.error('💥 [Cache Assets API] Error deleting assets:', error)
    return NextResponse.json(
      { error: 'Failed to delete assets' },
      { status: 500 }
    )
  }
}