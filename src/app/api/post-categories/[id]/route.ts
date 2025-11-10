import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

// GET /api/post-categories/[id] - Get single category
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const category = await prisma.postCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Error fetching post category:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch category'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/post-categories/[id] - Update category
const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional()
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validated = updateCategorySchema.parse(body)

    // Check if category exists
    const existing = await prisma.postCategory.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category not found'
        },
        { status: 404 }
      )
    }

    // If changing name, check for conflicts
    if (validated.name && validated.name !== existing.name) {
      const nameConflict = await prisma.postCategory.findUnique({
        where: { name: validated.name }
      })

      if (nameConflict) {
        return NextResponse.json(
          {
            success: false,
            error: 'Category with this name already exists'
          },
          { status: 409 }
        )
      }
    }

    const category = await prisma.postCategory.update({
      where: { id },
      data: validated
    })

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Error updating post category:', error)

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
        error: error instanceof Error ? error.message : 'Failed to update category'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/post-categories/[id] - Delete category
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Check if category exists and has posts
    const category = await prisma.postCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category not found'
        },
        { status: 404 }
      )
    }

    if (category._count.posts > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete category with ${category._count.posts} associated posts. Reassign posts first.`
        },
        { status: 409 }
      )
    }

    await prisma.postCategory.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting post category:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete category'
      },
      { status: 500 }
    )
  }
}
