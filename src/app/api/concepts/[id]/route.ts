import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// GET /api/concepts/[id] - Get a single concept with examples
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const concept = await prisma.conceptBank.findUnique({
      where: { id },
      include: {
        examples: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { examples: true }
        }
      }
    })

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(concept)
  } catch (error) {
    console.error('Failed to fetch concept:', error)
    return NextResponse.json(
      { error: 'Failed to fetch concept' },
      { status: 500 }
    )
  }
}

// PATCH /api/concepts/[id] - Update a concept
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      title,
      coreMessage,
      type,
      isActive
    } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (coreMessage !== undefined) updateData.coreMessage = coreMessage
    if (type !== undefined) updateData.type = type
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await prisma.conceptBank.update({
      where: { id },
      data: updateData,
      include: {
        examples: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { examples: true }
        }
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update concept:', error)
    return NextResponse.json(
      { error: 'Failed to update concept' },
      { status: 500 }
    )
  }
}

// DELETE /api/concepts/[id] - Delete a concept (examples deleted via cascade)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.conceptBank.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete concept:', error)
    return NextResponse.json(
      { error: 'Failed to delete concept' },
      { status: 500 }
    )
  }
}
