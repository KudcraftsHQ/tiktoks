import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params

    // Check if post exists
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Get all collections this post is in
    const collectionPosts = await prisma.collectionPost.findMany({
      where: { postId },
      include: {
        collection: {
          select: {
            id: true,
            name: true,
            color: true,
            isDefault: true
          }
        }
      }
    })

    const collections = collectionPosts.map(cp => cp.collection)

    return NextResponse.json({
      postId,
      collections,
      isBookmarked: collections.length > 0
    })
  } catch (error) {
    console.error('Failed to fetch post collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post collections' },
      { status: 500 }
    )
  }
}