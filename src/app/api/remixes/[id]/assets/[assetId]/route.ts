import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { assetId } = await context.params
    const body = await request.json()

    const asset = await prisma.remixAsset.update({
      where: { id: assetId },
      data: body
    })

    return NextResponse.json(asset)
  } catch (error) {
    console.error('Failed to update remix asset:', error)
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { assetId } = await context.params

    await prisma.remixAsset.delete({
      where: { id: assetId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete remix asset:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    )
  }
}
