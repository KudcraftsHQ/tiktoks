import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

/**
 * GET /api/projects/[id]/assets
 * Fetch all available assets for a project
 * Returns images from all posts in the project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Fetch project with posts
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        posts: {
          include: {
            post: {
              select: {
                id: true,
                images: true,
                authorHandle: true
              }
            }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Extract all images from posts
    const assets: Array<{
      id: string
      cacheAssetId: string
      name?: string
      width?: number
      height?: number
      source: 'post'
      postId: string
      slideIndex: number
    }> = []

    for (const projectPost of project.posts) {
      const post = projectPost.post

      try {
        // Parse images JSON
        const images = typeof post.images === 'string'
          ? JSON.parse(post.images)
          : (Array.isArray(post.images) ? post.images : [])

        // Add each image as an asset
        images.forEach((img: any, index: number) => {
          if (img.cacheAssetId) {
            assets.push({
              id: `${post.id}-img-${index}`,
              cacheAssetId: img.cacheAssetId,
              name: `@${post.authorHandle} - Slide ${index + 1}`,
              width: img.width,
              height: img.height,
              source: 'post',
              postId: post.id,
              slideIndex: index
            })
          }
        })
      } catch (error) {
        console.error(`Failed to parse images for post ${post.id}:`, error)
      }
    }

    return NextResponse.json({
      assets,
      count: assets.length
    })
  } catch (error) {
    console.error('Failed to fetch project assets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}
