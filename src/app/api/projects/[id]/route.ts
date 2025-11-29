import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  productContextId: z.string().nullable().optional()
})

// Helper function to convert BigInt and Date values for JSON serialization
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString()
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeBigInt(obj[key])
      }
    }
    return serialized
  }

  return obj
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        },
        posts: {
          include: {
            post: true
          },
          orderBy: {
            addedAt: 'desc'
          }
        },
        remixes: {
          where: {
            isDraft: true
          },
          select: {
            id: true,
            name: true,
            description: true,
            generationType: true,
            bookmarked: true,
            approved: true,
            createdAt: true,
            updatedAt: true,
            slides: true,
            slideClassifications: true, // JSON field, not a relation
            productContext: {
              select: {
                id: true,
                title: true,
                description: true
              }
            }
          },
          orderBy: [
            { createdAt: 'asc' },  // Oldest first for consistent ordering
            { id: 'asc' }          // Secondary sort by id for stability
          ]
        },
        _count: {
          select: {
            posts: true,
            remixes: true
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

    // Parse JSON fields in posts
    const processedProject = {
      ...project,
      posts: project.posts.map(({ post, ...projectPost }) => ({
        ...projectPost,
        post: {
          ...post,
          // Parse images JSON if it's a string
          images: typeof post.images === 'string' ? JSON.parse(post.images) : post.images,
          // Parse hashtags JSON if it's a string
          hashtags: typeof post.hashtags === 'string' ? JSON.parse(post.hashtags) : post.hashtags,
          // Parse mentions JSON if it's a string
          mentions: typeof post.mentions === 'string' ? JSON.parse(post.mentions) : post.mentions,
          // Parse ocrTexts JSON if it's a string
          ocrTexts: typeof post.ocrTexts === 'string' ? JSON.parse(post.ocrTexts) : post.ocrTexts,
          // Parse imageDescriptions JSON if it's a string
          imageDescriptions: typeof post.imageDescriptions === 'string' ? JSON.parse(post.imageDescriptions) : post.imageDescriptions,
          // Parse slideClassifications JSON if it's a string
          slideClassifications: typeof post.slideClassifications === 'string' ? JSON.parse(post.slideClassifications) : post.slideClassifications,
        }
      }))
    }

    // Serialize BigInt values before returning
    const serializedProject = serializeBigInt(processedProject)
    return NextResponse.json(serializedProject)
  } catch (error) {
    console.error('Failed to fetch project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = UpdateProjectSchema.parse(body)

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check if name is being changed and if it conflicts
    if (validatedData.name && validatedData.name !== existingProject.name) {
      const nameConflict = await prisma.project.findFirst({
        where: {
          name: {
            equals: validatedData.name,
            mode: 'insensitive'
          },
          NOT: {
            id: id
          }
        }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'A project with this name already exists' },
          { status: 400 }
        )
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: validatedData,
      include: {
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      }
    })

    const serializedProject = serializeBigInt(project)
    return NextResponse.json(serializedProject)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate productContextId if provided
    if (body.productContextId !== undefined && body.productContextId !== null) {
      const contextExists = await prisma.productContext.findUnique({
        where: { id: body.productContextId }
      })

      if (!contextExists) {
        return NextResponse.json(
          { error: 'Product context not found' },
          { status: 404 }
        )
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        productContextId: body.productContextId === null ? null : body.productContextId
      },
      include: {
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        }
      }
    })

    const serializedProject = serializeBigInt(updatedProject)
    return NextResponse.json(serializedProject)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of default project
    if (existingProject.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default project' },
        { status: 400 }
      )
    }

    // Delete the project (cascade will handle ProjectPost records)
    await prisma.project.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: 'Project deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}