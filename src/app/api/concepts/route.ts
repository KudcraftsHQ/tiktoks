import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// GET /api/concepts - List all concepts with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const source = searchParams.get('source')
    const freshness = searchParams.get('freshness')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: any = {}

    if (category) {
      where.category = category
    }

    if (source) {
      where.source = source
    }

    if (freshness) {
      where.freshness = freshness
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { concept: { contains: search, mode: 'insensitive' } },
        { insiderTerm: { contains: search, mode: 'insensitive' } },
        { explanation: { contains: search, mode: 'insensitive' } },
        { viralAngle: { contains: search, mode: 'insensitive' } }
      ]
    }

    const concepts = await prisma.conceptBank.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    })

    // Get summary stats
    const stats = await prisma.conceptBank.groupBy({
      by: ['category'],
      _count: { id: true }
    })

    const totalCount = await prisma.conceptBank.count({ where })

    return NextResponse.json({
      concepts,
      totalCount,
      stats: stats.reduce((acc, s) => {
        acc[s.category] = s._count.id
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    console.error('Failed to fetch concepts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch concepts' },
      { status: 500 }
    )
  }
}

// POST /api/concepts - Create a new concept manually
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      concept,
      insiderTerm,
      explanation,
      consequence,
      viralAngle,
      proofPhrase,
      credibilitySource,
      category
    } = body

    if (!concept || !explanation) {
      return NextResponse.json(
        { error: 'concept and explanation are required' },
        { status: 400 }
      )
    }

    // Generate hash for deduplication
    const crypto = await import('crypto')
    const normalized = `${concept.toLowerCase().trim()}|${explanation.toLowerCase().trim()}`
    const conceptHash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32)

    // Check for duplicates
    const existing = await prisma.conceptBank.findUnique({
      where: { conceptHash }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A similar concept already exists', existingId: existing.id },
        { status: 409 }
      )
    }

    const newConcept = await prisma.conceptBank.create({
      data: {
        concept,
        insiderTerm: insiderTerm || null,
        explanation,
        consequence: consequence || null,
        viralAngle: viralAngle || null,
        proofPhrase: proofPhrase || null,
        credibilitySource: credibilitySource || null,
        category: category || 'ALGORITHM_MECHANICS',
        source: 'CURATED',
        conceptHash,
        freshness: 'HIGH',
        timesUsed: 0,
        isActive: true
      }
    })

    return NextResponse.json(newConcept, { status: 201 })
  } catch (error) {
    console.error('Failed to create concept:', error)
    return NextResponse.json(
      { error: 'Failed to create concept' },
      { status: 500 }
    )
  }
}
