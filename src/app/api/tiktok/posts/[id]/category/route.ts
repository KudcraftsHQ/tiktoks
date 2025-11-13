import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const updateCategorySchema = z.object({
  categoryId: z.string().nullable()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validated = updateCategorySchema.parse(body)

    // Check if post exists
    const post = await prisma.tiktokPost.findUnique({
      where: { id }
    })

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          error: 'Post not found'
        },
        { status: 404 }
      )
    }

    // If categoryId is provided, verify it exists
    if (validated.categoryId) {
      const category = await prisma.postCategory.findUnique({
        where: { id: validated.categoryId }
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
    }

    // Update the post's category using a transaction to handle counts
    const result = await prisma.$transaction(async (tx) => {
      // Get old category ID before update
      const oldCategoryId = post.postCategoryId

      // Update the post
      const updatedPost = await tx.tiktokPost.update({
        where: { id },
        data: {
          postCategoryId: validated.categoryId
        },
        include: {
          postCategory: true
        }
      })

      // Update old category count (decrement)
      if (oldCategoryId) {
        await tx.postCategory.update({
          where: { id: oldCategoryId },
          data: {
            postCount: {
              decrement: 1
            }
          }
        })
      }

      // Update new category count (increment)
      if (validated.categoryId) {
        await tx.postCategory.update({
          where: { id: validated.categoryId },
          data: {
            postCount: {
              increment: 1
            }
          }
        })
      }

      return updatedPost
    })

    return NextResponse.json({
      success: true,
      data: result
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
        error: error instanceof Error ? error.message : 'Failed to update post category'
      },
      { status: 500 }
    )
  }
}
