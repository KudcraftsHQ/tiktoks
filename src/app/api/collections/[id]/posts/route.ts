import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const AddPostToCollectionSchema = z.object({
  postId: z.string().min(1)
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params
    const body = await request.json()
    const { postId } = AddPostToCollectionSchema.parse(body)

    // Check if collection exists
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

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

    // Check if post is already in collection
    const existingCollectionPost = await prisma.collectionPost.findUnique({
      where: {
        collectionId_postId: {
          collectionId,
          postId
        }
      }
    })

    if (existingCollectionPost) {
      return NextResponse.json(
        { error: 'Post is already in this collection' },
        { status: 400 }
      )
    }

    // Add post to collection
    const collectionPost = await prisma.collectionPost.create({
      data: {
        collectionId,
        postId
      },
      include: {
        post: true,
        collection: true
      }
    })

    return NextResponse.json(collectionPost, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to add post to collection:', error)
    return NextResponse.json(
      { error: 'Failed to add post to collection' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const skip = (page - 1) * limit

    // Check if collection exists
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    const [collectionPosts, total] = await Promise.all([
      prisma.collectionPost.findMany({
        where: { collectionId },
        include: {
          post: true
        },
        orderBy: {
          addedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.collectionPost.count({
        where: { collectionId }
      })
    ])

    const hasMore = skip + limit < total

    return NextResponse.json({
      posts: collectionPosts.map(cp => cp.post),
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch collection posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection posts' },
      { status: 500 }
    )
  }
}