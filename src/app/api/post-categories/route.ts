import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

// GET /api/post-categories - List all categories
export async function GET() {
  try {
    const categories = await prisma.postCategory.findMany({
      orderBy: [
        { postCount: 'desc' }, // Most used first
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('Error fetching post categories:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch categories'
      },
      { status: 500 }
    )
  }
}

// POST /api/post-categories - Create new category
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createCategorySchema.parse(body)

    // Check if category already exists
    const existing = await prisma.postCategory.findUnique({
      where: { name: validated.name }
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category with this name already exists'
        },
        { status: 409 }
      )
    }

    const category = await prisma.postCategory.create({
      data: {
        name: validated.name,
        description: validated.description,
        aiGenerated: false // Manually created
      }
    })

    return NextResponse.json({
      success: true,
      data: category
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating post category:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.issues
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create category'
      },
      { status: 500 }
    )
  }
}
