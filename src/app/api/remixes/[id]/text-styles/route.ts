import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const textStyles = await prisma.remixTextStyle.findMany({
      where: { remixId: id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json(textStyles)
  } catch (error) {
    console.error('Failed to fetch text styles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch text styles' },
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

    // Verify remix exists
    const remix = await prisma.remixPost.findUnique({
      where: { id }
    })

    if (!remix) {
      return NextResponse.json(
        { error: 'Remix not found' },
        { status: 404 }
      )
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.remixTextStyle.updateMany({
        where: { remixId: id, isDefault: true },
        data: { isDefault: false }
      })
    }

    const textStyle = await prisma.remixTextStyle.create({
      data: {
        remixId: id,
        name: body.name,
        isDefault: body.isDefault ?? false,
        fontSize: body.fontSize ?? 24,
        fontFamily: body.fontFamily ?? 'Poppins',
        fontWeight: body.fontWeight ?? 'normal',
        fontStyle: body.fontStyle ?? 'normal',
        textDecoration: body.textDecoration ?? 'none',
        color: body.color ?? '#000000',
        textAlign: body.textAlign ?? 'center',
        enableShadow: body.enableShadow ?? false,
        shadowColor: body.shadowColor,
        shadowBlur: body.shadowBlur,
        shadowOffsetX: body.shadowOffsetX,
        shadowOffsetY: body.shadowOffsetY,
        outlineWidth: body.outlineWidth ?? 0,
        outlineColor: body.outlineColor,
        backgroundColor: body.backgroundColor ?? '#ffffff',
        backgroundOpacity: body.backgroundOpacity ?? 1,
        borderRadius: body.borderRadius ?? 0,
        borderWidth: body.borderWidth ?? 0,
        borderColor: body.borderColor,
        paddingTop: body.paddingTop ?? 8,
        paddingRight: body.paddingRight ?? 12,
        paddingBottom: body.paddingBottom ?? 8,
        paddingLeft: body.paddingLeft ?? 12,
        lineHeight: body.lineHeight ?? 1.2,
        letterSpacing: body.letterSpacing ?? 0,
        wordSpacing: body.wordSpacing ?? 0
      }
    })

    return NextResponse.json(textStyle)
  } catch (error) {
    console.error('Failed to create text style:', error)
    return NextResponse.json(
      { error: 'Failed to create text style' },
      { status: 500 }
    )
  }
}
