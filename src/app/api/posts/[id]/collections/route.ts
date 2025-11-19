import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params

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

    // Get all projects this post is in
    const projectPosts = await prisma.projectPost.findMany({
      where: { postId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            isDefault: true
          }
        }
      }
    })

    const projects = projectPosts.map(pp => pp.project)

    return NextResponse.json({
      postId,
      projects,
      isBookmarked: projects.length > 0
    })
  } catch (error) {
    console.error('Failed to fetch post collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post collections' },
      { status: 500 }
    )
  }
}