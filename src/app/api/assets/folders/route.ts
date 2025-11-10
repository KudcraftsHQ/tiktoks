import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const folders = await prisma.assetFolder.findMany({
      include: {
        _count: {
          select: { assets: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(folders)
  } catch (error) {
    console.error('Failed to fetch folders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const folder = await prisma.assetFolder.create({
      data: {
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
    console.error('Failed to create folder:', error)
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
