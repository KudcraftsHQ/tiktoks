import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const { folderId } = await context.params
    const body = await request.json()

    const folder = await prisma.remixAssetFolder.update({
      where: { id: folderId },
      data: { name: body.name },
      include: {
        _count: {
          select: { assets: true }
        }
      }
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error('Failed to update remix folder:', error)
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const { folderId } = await context.params

    // Delete folder (assets will have their folderId set to null via onDelete: SetNull)
    await prisma.remixAssetFolder.delete({
      where: { id: folderId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete remix folder:', error)
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
