import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const { id: collectionId, postId } = await params

    // Check if the collection post relationship exists
    const collectionPost = await prisma.collectionPost.findUnique({
      where: {
        collectionId_postId: {
          collectionId,
          postId
        }
      }
    })

    if (!collectionPost) {
      return NextResponse.json(
        { error: 'Post not found in collection' },
        { status: 404 }
      )
    }

    // Remove post from collection
    await prisma.collectionPost.delete({
      where: {
        collectionId_postId: {
          collectionId,
          postId
        }
      }
    })

    return NextResponse.json(
      { message: 'Post removed from collection successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to remove post from collection:', error)
    return NextResponse.json(
      { error: 'Failed to remove post from collection' },
      { status: 500 }
    )
  }
}