import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')
    const hasFace = searchParams.get('hasFace')

    const where: any = {}

    if (folderId === 'null' || folderId === '') {
      // Root level (no folder)
      where.folderId = null
    } else if (folderId) {
      // Specific folder
      where.folderId = folderId
    }

    // Filter by face detection result
    if (hasFace === 'true') {
      where.hasFace = true
    } else if (hasFace === 'false') {
      where.hasFace = false
    }
    // If hasFace is not specified or any other value, show all assets

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    // Resolve URLs for all assets
    const cacheAssetIds = assets.map(a => a.cacheAssetId)
    const urls = await cacheAssetService.getUrls(cacheAssetIds)

    const assetsWithUrls = assets.map((asset, index) => ({
      ...asset,
      url: urls[index]
    }))

    return NextResponse.json(assetsWithUrls)
  } catch (error) {
    console.error('Failed to fetch assets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const asset = await prisma.asset.create({
      data: {
        folderId: body.folderId || null,
        cacheAssetId: body.cacheAssetId,
        name: body.name,
        width: body.width,
        height: body.height
      }
    })

    const url = await cacheAssetService.getUrl(asset.cacheAssetId)

    return NextResponse.json({
      ...asset,
      url
    })
  } catch (error) {
    console.error('Failed to create asset:', error)
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    )
  }
}
