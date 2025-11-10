import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { deleteFromR2 } from '@/lib/r2'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const asset = await prisma.asset.update({
      where: { id },
      data: body
    })

    return NextResponse.json(asset)
  } catch (error) {
    console.error('Failed to update asset:', error)
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Get asset to find R2 key
    const asset = await prisma.asset.findUnique({
      where: { id }
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Get cache asset to find R2 key
    const cacheAsset = await prisma.cacheAsset.findUnique({
      where: { id: asset.cacheAssetId }
    })

    // Delete from database first
    await prisma.asset.delete({
      where: { id }
    })

    // Try to delete from R2 if we have a key
    if (cacheAsset?.cacheKey) {
      try {
        await deleteFromR2(cacheAsset.cacheKey)
      } catch (error) {
        console.error('Failed to delete from R2:', error)
        // Don't fail the request if R2 deletion fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete asset:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    )
  }
}
