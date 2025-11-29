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

    // Only filter by type if it's a valid enum value (not "all")
    if (type && type.toUpperCase() !== 'ALL') {
      where.type = type.toUpperCase()
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
    // Within each type, sort manually created concepts by creation date (oldest first)
    const typeOrder: Record<string, number> = { HOOK: 0, CONTENT: 1, CTA: 2 }
    conceptsWithSortedExamples.sort((a, b) => {
      const typeA = typeOrder[a.type] ?? 99
      const typeB = typeOrder[b.type] ?? 99

      // First sort by type
      if (typeA !== typeB) {
        return typeA - typeB
      }

      // Within same type, check if both are manually created (all examples are MANUAL sourceType)
      const aIsManual = a.examples.length > 0 && a.examples.every(ex => ex.sourceType === 'MANUAL')
      const bIsManual = b.examples.length > 0 && b.examples.every(ex => ex.sourceType === 'MANUAL')

      // If both are manual or both are not manual, sort by creation date (oldest first)
      if ((aIsManual && bIsManual) || (!aIsManual && !bIsManual)) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }

      // Manual concepts come before non-manual ones
      return aIsManual ? -1 : 1
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

// Helper function to generate concept title and core message from example texts using AI
async function generateConceptFromExamples(exampleTexts: string[], type: string): Promise<{ title: string; coreMessage: string }> {
  // Import Gemini using the same pattern as content-generation-service
  const { GoogleGenAI } = await import('@google/genai')

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // Fallback to simple title generation
    const firstText = exampleTexts[0] || ''
    const truncated = firstText.slice(0, 50) + (firstText.length > 50 ? '...' : '')
    return {
      title: `New ${type} Concept`,
      coreMessage: truncated || 'No examples provided'
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `You are analyzing content examples for a TikTok carousel content bank.

Given these example texts that belong to a ${type} slide type:
${exampleTexts.map((text, i) => `${i + 1}. "${text}"`).join('\n')}

Generate a concise concept title (3-6 words) and a core message (1-2 sentences) that captures the common theme or pattern across these examples.

The type is ${type}:
- HOOK: Opening slide patterns that grab attention
- CONTENT: Body slide lessons that provide value
- CTA: Closing slide patterns with calls to action

Respond in JSON format only:
{
  "title": "Your Concept Title Here",
  "coreMessage": "A brief description of the core message or pattern these examples share."
}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt
    })

    const responseText = response.text || ''

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        title: parsed.title || `New ${type} Concept`,
        coreMessage: parsed.coreMessage || 'Auto-generated concept'
      }
    }
  } catch (error) {
    console.error('Failed to generate concept with AI:', error)
  }

  // Fallback
  const firstText = exampleTexts[0] || ''
  const truncated = firstText.slice(0, 50) + (firstText.length > 50 ? '...' : '')
  return {
    title: `New ${type} Concept`,
    coreMessage: truncated || 'No examples provided'
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
      exampleText, // Optional initial example
      exampleIds,  // Optional: Move existing examples to this new concept
      autoGenerate // Optional: Auto-generate title/coreMessage from examples
    } = body

    // If exampleIds provided with autoGenerate, fetch examples and generate title/coreMessage
    let finalTitle = title
    let finalCoreMessage = coreMessage

    if (exampleIds && Array.isArray(exampleIds) && exampleIds.length > 0 && autoGenerate) {
      // Fetch the example texts
      const examples = await prisma.conceptExample.findMany({
        where: { id: { in: exampleIds } }
      })

      const exampleTexts = examples.map(e => e.text)
      const generated = await generateConceptFromExamples(exampleTexts, type || 'CONTENT')

      finalTitle = finalTitle || generated.title
      finalCoreMessage = finalCoreMessage || generated.coreMessage
    }

    if (!finalTitle || !finalCoreMessage) {
      return NextResponse.json(
        { error: 'title and coreMessage are required (or provide exampleIds with autoGenerate=true)' },
        { status: 400 }
      )
    }

    // Create the new concept
    const newConcept = await prisma.conceptBank.create({
      data: {
        title: finalTitle,
        coreMessage: finalCoreMessage,
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

    // If exampleIds provided, move those examples to this new concept
    if (exampleIds && Array.isArray(exampleIds) && exampleIds.length > 0) {
      await prisma.conceptExample.updateMany({
        where: { id: { in: exampleIds } },
        data: { conceptId: newConcept.id }
      })

      // Fetch updated concept with examples
      const updatedConcept = await prisma.conceptBank.findUnique({
        where: { id: newConcept.id },
        include: {
          examples: {
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: { examples: true }
          }
        }
      })

      return NextResponse.json(updatedConcept, { status: 201 })
    }

    return NextResponse.json(newConcept, { status: 201 })
  } catch (error) {
    console.error('Failed to create concept:', error)
    return NextResponse.json(
      { error: 'Failed to create concept' },
      { status: 500 }
    )
  }
}
