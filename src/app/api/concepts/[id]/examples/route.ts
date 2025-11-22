import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// PATCH /api/concepts/[id]/examples - Update an example
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conceptId } = await params
    const body = await request.json()

    const { exampleId, text } = body

    if (!exampleId || !text) {
      return NextResponse.json(
        { error: 'exampleId and text are required' },
        { status: 400 }
      )
    }

    // Verify example exists and belongs to this concept
    const example = await prisma.conceptExample.findFirst({
      where: { id: exampleId, conceptId }
    })

    if (!example) {
      return NextResponse.json(
        { error: 'Example not found' },
        { status: 404 }
      )
    }

    // Only allow editing manual examples
    if (example.sourceType !== 'MANUAL') {
      return NextResponse.json(
        { error: 'Only manual examples can be edited' },
        { status: 400 }
      )
    }

    const updated = await prisma.conceptExample.update({
      where: { id: exampleId },
      data: { text }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update example:', error)
    return NextResponse.json(
      { error: 'Failed to update example' },
      { status: 500 }
    )
  }
}

// DELETE /api/concepts/[id]/examples - Delete an example
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conceptId } = await params
    const { searchParams } = new URL(request.url)
    const exampleId = searchParams.get('exampleId')

    if (!exampleId) {
      return NextResponse.json(
        { error: 'exampleId is required' },
        { status: 400 }
      )
    }

    // Verify example exists and belongs to this concept
    const example = await prisma.conceptExample.findFirst({
      where: { id: exampleId, conceptId }
    })

    if (!example) {
      return NextResponse.json(
        { error: 'Example not found' },
        { status: 404 }
      )
    }

    await prisma.conceptExample.delete({
      where: { id: exampleId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete example:', error)
    return NextResponse.json(
      { error: 'Failed to delete example' },
      { status: 500 }
    )
  }
}

// POST /api/concepts/[id]/examples - Add an example to a concept
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conceptId } = await params
    const body = await request.json()

    const {
      text,
      sourceType,
      sourcePostId,
      sourceSlideIndex
    } = body

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      )
    }

    // Verify concept exists
    const concept = await prisma.conceptBank.findUnique({
      where: { id: conceptId }
    })

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      )
    }

    const example = await prisma.conceptExample.create({
      data: {
        conceptId,
        text,
        sourceType: sourceType || 'MANUAL',
        sourcePostId: sourcePostId || null,
        sourceSlideIndex: sourceSlideIndex !== undefined ? sourceSlideIndex : null
      }
    })

    return NextResponse.json(example, { status: 201 })
  } catch (error) {
    console.error('Failed to add example:', error)
    return NextResponse.json(
      { error: 'Failed to add example' },
      { status: 500 }
    )
  }
}
