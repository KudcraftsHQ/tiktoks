import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const folders = await prisma.remixAssetFolder.findMany({
      where: { remixId: id },
      include: {
        _count: {
          select: { assets: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(folders)
  } catch (error) {
    console.error('Failed to fetch remix folders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
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

    const folder = await prisma.remixAssetFolder.create({
      data: {
        remixId: id,
        name: body.name
      },
      include: {
        _count: {
          select: { assets: true }
        }
      }
    })

    return NextResponse.json(folder)
  } catch (error) {
    console.error('Failed to create remix folder:', error)
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
