import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// GET /api/concepts - List all concepts with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const type = searchParams.get('type') // HOOK, CONTENT, CTA
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: any = {}

    if (type) {
      where.type = type
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { coreMessage: { contains: search, mode: 'insensitive' } },
        // Search in examples text
        { examples: { some: { text: { contains: search, mode: 'insensitive' } } } }
      ]
    }

    const concepts = await prisma.conceptBank.findMany({
      where,
      include: {
        examples: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { examples: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
    })

    // Collect all sourcePostIds from examples
    const sourcePostIds = concepts.flatMap(c =>
      c.examples
        .filter(e => e.sourcePostId)
        .map(e => e.sourcePostId!)
    )

    // Fetch source posts if there are any
    const sourcePosts = sourcePostIds.length > 0
      ? await prisma.tiktokPost.findMany({
          where: { id: { in: sourcePostIds } },
          select: {
            id: true,
            viewCount: true,
            images: true,
          }
        })
      : []

    // Create a map for quick lookup, converting BigInt to number for JSON serialization
    const postMap = new Map(sourcePosts.map(p => [p.id, {
      id: p.id,
      viewCount: p.viewCount ? Number(p.viewCount) : null,
      images: p.images,
    }]))

    // Enrich examples with source post data and sort by viewCount
    const conceptsWithSortedExamples = concepts.map(concept => ({
      ...concept,
      examples: [...concept.examples]
        .map(example => ({
          ...example,
          sourcePost: example.sourcePostId ? postMap.get(example.sourcePostId) || null : null
        }))
        .sort((a, b) => {
          const viewsA = Number(a.sourcePost?.viewCount ?? 0)
          const viewsB = Number(b.sourcePost?.viewCount ?? 0)
          return viewsB - viewsA
        })
    }))

    // Sort concepts by type: HOOK -> CONTENT -> CTA
    const typeOrder: Record<string, number> = { HOOK: 0, CONTENT: 1, CTA: 2 }
    conceptsWithSortedExamples.sort((a, b) => {
      const typeA = typeOrder[a.type] ?? 99
      const typeB = typeOrder[b.type] ?? 99
      return typeA - typeB
    })

    // Get counts by type
    const typeCounts = await prisma.conceptBank.groupBy({
      by: ['type'],
      _count: { id: true }
    })

    const totalCount = await prisma.conceptBank.count({ where })

    // Group by type for easier frontend consumption
    const grouped = {
      HOOK: conceptsWithSortedExamples.filter(c => c.type === 'HOOK'),
      CONTENT: conceptsWithSortedExamples.filter(c => c.type === 'CONTENT'),
      CTA: conceptsWithSortedExamples.filter(c => c.type === 'CTA')
    }

    return NextResponse.json({
      concepts: conceptsWithSortedExamples,
      grouped,
      totalCount,
      typeCounts: typeCounts.reduce((acc, t) => {
        acc[t.type] = t._count.id
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

// POST /api/concepts - Create a new concept
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      title,
      coreMessage,
      type,
      exampleText // Optional initial example
    } = body

    if (!title || !coreMessage) {
      return NextResponse.json(
        { error: 'title and coreMessage are required' },
        { status: 400 }
      )
    }

    const newConcept = await prisma.conceptBank.create({
      data: {
        title,
        coreMessage,
        type: type || 'CONTENT',
        isActive: true,
        timesUsed: 0,
        // Create initial example if provided
        ...(exampleText ? {
          examples: {
            create: {
              text: exampleText,
              sourceType: 'MANUAL'
            }
          }
        } : {})
      },
      include: {
        examples: true,
        _count: {
          select: { examples: true }
        }
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
