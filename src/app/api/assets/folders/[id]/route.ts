import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const folder = await prisma.assetFolder.update({
      where: { id },
      data: { name: body.name },
      include: {
        _count: {
          select: { assets: true }
        }
      }
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error('Failed to update folder:', error)
    return NextResponse.json(
      { error: 'Failed to update folder' },
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

    // Delete folder (assets will have folderId set to null due to onDelete: SetNull)
    await prisma.assetFolder.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete folder:', error)
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
