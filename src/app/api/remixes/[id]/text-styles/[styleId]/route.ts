import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; styleId: string }> }
) {
  try {
    const { id, styleId } = await context.params
    const body = await request.json()

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.remixTextStyle.updateMany({
        where: { remixId: id, isDefault: true, id: { not: styleId } },
        data: { isDefault: false }
      })
    }

    const textStyle = await prisma.remixTextStyle.update({
      where: { id: styleId },
      data: body
    })

    return NextResponse.json(textStyle)
  } catch (error) {
    console.error('Failed to update text style:', error)
    return NextResponse.json(
      { error: 'Failed to update text style' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; styleId: string }> }
) {
  try {
    const { styleId } = await context.params

    await prisma.remixTextStyle.delete({
      where: { id: styleId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete text style:', error)
    return NextResponse.json(
      { error: 'Failed to delete text style' },
      { status: 500 }
    )
  }
}
