import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const AddPostsToProjectSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1, 'At least one post ID is required')
})

const RemovePostsFromProjectSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1, 'At least one post ID is required')
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { postIds } = AddPostsToProjectSchema.parse(body)

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check if all posts exist
    const posts = await prisma.tiktokPost.findMany({
      where: { id: { in: postIds } }
    })

    if (posts.length !== postIds.length) {
      const foundIds = posts.map(p => p.id)
      const missingIds = postIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        { error: `Posts not found: ${missingIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Check which posts are already in the project
    const existingProjectPosts = await prisma.projectPost.findMany({
      where: {
        projectId,
        postId: { in: postIds }
      }
    })

    const existingPostIds = existingProjectPosts.map(pp => pp.postId)
    const newPostIds = postIds.filter(id => !existingPostIds.includes(id))

    // Add only new posts to project
    const results = {
      added: 0,
      skipped: existingPostIds.length,
      errors: 0
    }

    if (newPostIds.length > 0) {
      const projectPosts = await prisma.projectPost.createMany({
        data: newPostIds.map(postId => ({
          projectId,
          postId
        })),
        skipDuplicates: true
      })
      results.added = projectPosts.count
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Added ${results.added} post(s). ${results.skipped > 0 ? `Skipped ${results.skipped} duplicate(s).` : ''}`
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to add posts to project:', error)
    return NextResponse.json(
      { error: 'Failed to add posts to project' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const skip = (page - 1) * limit

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const [projectPosts, total] = await Promise.all([
      prisma.projectPost.findMany({
        where: { projectId },
        include: {
          post: true
        },
        orderBy: {
          addedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.projectPost.count({
        where: { projectId }
      })
    ])

    const hasMore = skip + limit < total

    return NextResponse.json({
      posts: projectPosts.map(cp => cp.post),
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch project posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project posts' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { postIds } = RemovePostsFromProjectSchema.parse(body)

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Remove posts from project
    const result = await prisma.projectPost.deleteMany({
      where: {
        projectId,
        postId: { in: postIds }
      }
    })

    return NextResponse.json({
      success: true,
      removed: result.count,
      message: `Removed ${result.count} post(s) from project`
    }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to remove posts from project:', error)
    return NextResponse.json(
      { error: 'Failed to remove posts from project' },
      { status: 500 }
    )
  }
}