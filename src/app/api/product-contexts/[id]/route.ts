import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()
import { z } from 'zod'

const updateProductContextSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().min(1, 'Description is required').optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const productContext = await prisma.productContext.findUnique({
      where: { id },
    })

    if (!productContext) {
      return NextResponse.json(
        { error: 'Product context not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(productContext)
  } catch (error) {
    console.error('Error fetching product context:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product context' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const validatedData = updateProductContextSchema.parse(body)

    const productContext = await prisma.productContext.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(productContext)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Product context not found' },
        { status: 404 }
      )
    }

    console.error('Error updating product context:', error)
    return NextResponse.json(
      { error: 'Failed to update product context' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.productContext.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { error: 'Product context not found' },
        { status: 404 }
      )
    }

    console.error('Error deleting product context:', error)
    return NextResponse.json(
      { error: 'Failed to delete product context' },
      { status: 500 }
    )
  }
}