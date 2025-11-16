import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id: projectId, postId } = await params

    // Check if the project post relationship exists
    const projectPost = await prisma.projectPost.findUnique({
      where: {
        projectId_postId: {
          projectId,
          postId
        }
      }
    })

    if (!projectPost) {
      return NextResponse.json(
        { error: 'Post not found in project' },
        { status: 404 }
      )
    }

    // Remove post from project
    await prisma.projectPost.delete({
      where: {
        projectId_postId: {
          projectId,
          postId
        }
      }
    })

    return NextResponse.json(
      { message: 'Post removed from project successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to remove post from project:', error)
    return NextResponse.json(
      { error: 'Failed to remove post from project' },
      { status: 500 }
    )
  }
}