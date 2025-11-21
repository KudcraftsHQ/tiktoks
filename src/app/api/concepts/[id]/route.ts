import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// GET /api/concepts/[id] - Get a single concept
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const concept = await prisma.conceptBank.findUnique({
      where: { id }
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
      concept,
      insiderTerm,
      explanation,
      consequence,
      viralAngle,
      proofPhrase,
      credibilitySource,
      category,
      isActive
    } = body

    const updateData: any = {}

    if (concept !== undefined) updateData.concept = concept
    if (insiderTerm !== undefined) updateData.insiderTerm = insiderTerm
    if (explanation !== undefined) updateData.explanation = explanation
    if (consequence !== undefined) updateData.consequence = consequence
    if (viralAngle !== undefined) updateData.viralAngle = viralAngle
    if (proofPhrase !== undefined) updateData.proofPhrase = proofPhrase
    if (credibilitySource !== undefined) updateData.credibilitySource = credibilitySource
    if (category !== undefined) updateData.category = category
    if (isActive !== undefined) updateData.isActive = isActive

    // If concept or explanation changed, update hash
    if (concept !== undefined || explanation !== undefined) {
      const existing = await prisma.conceptBank.findUnique({ where: { id } })
      if (existing) {
        const crypto = await import('crypto')
        const newConcept = concept ?? existing.concept
        const newExplanation = explanation ?? existing.explanation
        const normalized = `${newConcept.toLowerCase().trim()}|${newExplanation.toLowerCase().trim()}`
        updateData.conceptHash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32)
      }
    }

    const updated = await prisma.conceptBank.update({
      where: { id },
      data: updateData
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

// DELETE /api/concepts/[id] - Delete a concept
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
