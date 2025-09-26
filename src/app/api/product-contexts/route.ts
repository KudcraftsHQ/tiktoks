import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()
import { z } from 'zod'

const createProductContextSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
})

const updateProductContextSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().min(1, 'Description is required').optional(),
})

export async function GET() {
  try {
    const productContexts = await prisma.productContext.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(productContexts)
  } catch (error) {
    console.error('Error fetching product contexts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product contexts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createProductContextSchema.parse(body)

    const productContext = await prisma.productContext.create({
      data: validatedData,
    })

    return NextResponse.json(productContext, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating product context:', error)
    return NextResponse.json(
      { error: 'Failed to create product context' },
      { status: 500 }
    )
  }
}