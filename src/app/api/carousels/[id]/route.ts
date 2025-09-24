import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const carousel = await prisma.carousel.findUnique({
      where: { id: resolvedParams.id },
      include: {
        images: {
          orderBy: {
            displayOrder: 'asc'
          }
        }
      }
    })

    if (!carousel) {
      return NextResponse.json(
        { error: 'Carousel not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(carousel)
  } catch (error) {
    console.error('Failed to fetch carousel:', error)
    return NextResponse.json(
      { error: 'Failed to fetch carousel' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await prisma.carousel.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete carousel:', error)
    return NextResponse.json(
      { error: 'Failed to delete carousel' },
      { status: 500 }
    )
  }
}