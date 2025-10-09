import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const assets = await prisma.remixAsset.findMany({
      where: { remixId: id },
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
    console.error('Failed to fetch remix assets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const asset = await prisma.remixAsset.create({
      data: {
        remixId: id,
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
    console.error('Failed to create remix asset:', error)
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    )
  }
}
