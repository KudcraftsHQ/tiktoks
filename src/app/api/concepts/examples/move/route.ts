import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// PUT /api/concepts/examples/move - Move examples between concepts
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { exampleIds, targetConceptId } = body

    if (!exampleIds || !Array.isArray(exampleIds) || exampleIds.length === 0) {
      return NextResponse.json(
        { error: 'exampleIds array is required' },
        { status: 400 }
      )
    }

    if (!targetConceptId) {
      return NextResponse.json(
        { error: 'targetConceptId is required' },
        { status: 400 }
      )
    }

    // Verify target concept exists
    const targetConcept = await prisma.conceptBank.findUnique({
      where: { id: targetConceptId }
    })

    if (!targetConcept) {
      return NextResponse.json(
        { error: 'Target concept not found' },
        { status: 404 }
      )
    }

    // Move all examples to the target concept
    const result = await prisma.conceptExample.updateMany({
      where: { id: { in: exampleIds } },
      data: { conceptId: targetConceptId }
    })

    // Fetch updated examples with source post data
    const updatedExamples = await prisma.conceptExample.findMany({
      where: { id: { in: exampleIds } }
    })

    return NextResponse.json({
      success: true,
      movedCount: result.count,
      examples: updatedExamples
    })
  } catch (error) {
    console.error('Failed to move examples:', error)
    return NextResponse.json(
      { error: 'Failed to move examples' },
      { status: 500 }
    )
  }
}
