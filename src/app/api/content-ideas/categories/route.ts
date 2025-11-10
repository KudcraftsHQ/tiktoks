import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

const CreateCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['HOOK', 'CONTENT', 'CTA']),
  description: z.string().optional()
})

const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
})

/**
 * GET /api/content-ideas/categories
 * Get all categories, optionally filtered by type
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'HOOK' | 'CONTENT' | 'CTA' | null

    const categories = await prisma.contentIdeaCategory.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ type: 'asc' }, { slideCount: 'desc' }, { name: 'asc' }]
    })

    return NextResponse.json({
      categories,
      count: categories.length
    })
  } catch (error) {
    console.error('Failed to fetch categories:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/content-ideas/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = CreateCategorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { name, type, description } = validation.data

    const category = await prisma.contentIdeaCategory.create({
      data: {
        name,
        type,
        description,
        aiGenerated: false
      }
    })

    return NextResponse.json({
      success: true,
      category
    })
  } catch (error) {
    console.error('Failed to create category:', error)

    return NextResponse.json(
      {
        error: 'Failed to create category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/content-ideas/categories/:id
 * Update a category
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    const validation = UpdateCategorySchema.safeParse(updates)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const category = await prisma.contentIdeaCategory.update({
      where: { id },
      data: validation.data
    })

    return NextResponse.json({
      success: true,
      category
    })
  } catch (error) {
    console.error('Failed to update category:', error)

    return NextResponse.json(
      {
        error: 'Failed to update category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/content-ideas/categories/:id
 * Delete a category
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    await prisma.contentIdeaCategory.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Category deleted'
    })
  } catch (error) {
    console.error('Failed to delete category:', error)

    return NextResponse.json(
      {
        error: 'Failed to delete category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
