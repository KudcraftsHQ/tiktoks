import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { detectFaceForAsset } from '@/lib/face-detection-service'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify asset exists
    const asset = await prisma.asset.findUnique({
      where: { id }
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Perform face detection
    const result = await detectFaceForAsset(id)

    // Get updated asset with URL
    const updatedAsset = await prisma.asset.findUnique({
      where: { id }
    })

    const url = await cacheAssetService.getUrl(updatedAsset!.cacheAssetId)

    return NextResponse.json({
      ...updatedAsset,
      url
    })
  } catch (error) {
    console.error('Failed to analyze face:', error)
    return NextResponse.json(
      { error: 'Failed to analyze face' },
      { status: 500 }
    )
  }
}
