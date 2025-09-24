import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        posts: {
          include: {
            post: true
          },
          orderBy: {
            addedAt: 'desc'
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(collection)
  } catch (error) {
    console.error('Failed to fetch collection:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
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
    const validatedData = UpdateCollectionSchema.parse(body)

    // Check if collection exists
    const existingCollection = await prisma.collection.findUnique({
      where: { id }
    })

    if (!existingCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Check if name is being changed and if it conflicts
    if (validatedData.name && validatedData.name !== existingCollection.name) {
      const nameConflict = await prisma.collection.findFirst({
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
          { error: 'A collection with this name already exists' },
          { status: 400 }
        )
      }
    }

    const collection = await prisma.collection.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            posts: true
          }
        }
      }
    })

    return NextResponse.json(collection)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update collection:', error)
    return NextResponse.json(
      { error: 'Failed to update collection' },
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

    // Check if collection exists
    const existingCollection = await prisma.collection.findUnique({
      where: { id }
    })

    if (!existingCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of default collection
    if (existingCollection.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default collection' },
        { status: 400 }
      )
    }

    // Delete the collection (cascade will handle CollectionPost records)
    await prisma.collection.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: 'Collection deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete collection:', error)
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    )
  }
}