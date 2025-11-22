import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI } from '@google/genai'

const prisma = new PrismaClient()

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

interface SlideStructure {
  slideIndex: number
  type: 'HOOK' | 'CONTENT' | 'CTA'
}

interface ConceptSuggestion {
  slideIndex: number
  type: 'HOOK' | 'CONTENT' | 'CTA'
  conceptId: string
  conceptTitle: string
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, slideCount, projectId } = body

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    const numSlides = slideCount || 4

    // Build slide structure: HOOK, CONTENT×(n-2), CTA
    const slideStructure: SlideStructure[] = []
    for (let i = 0; i < numSlides; i++) {
      if (i === 0) {
        slideStructure.push({ slideIndex: i, type: 'HOOK' })
      } else if (i === numSlides - 1) {
        slideStructure.push({ slideIndex: i, type: 'CTA' })
      } else {
        slideStructure.push({ slideIndex: i, type: 'CONTENT' })
      }
    }

    // Fetch all active concepts grouped by type
    const concepts = await prisma.conceptBank.findMany({
      where: { isActive: true },
      include: {
        examples: {
          take: 3,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { examples: true }
        }
      },
      orderBy: [
        { timesUsed: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    const hookConcepts = concepts.filter(c => c.type === 'HOOK')
    const contentConcepts = concepts.filter(c => c.type === 'CONTENT')
    const ctaConcepts = concepts.filter(c => c.type === 'CTA')

    // If no concepts available, return empty suggestions
    if (concepts.length === 0) {
      return NextResponse.json({
        suggestions: slideStructure.map(s => ({
          slideIndex: s.slideIndex,
          type: s.type,
          conceptId: null,
          conceptTitle: null,
          reason: 'No concepts available in bank'
        }))
      })
    }

    // Get reference post context if projectId provided
    let referenceContext = ''
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          posts: {
            include: {
              post: {
                select: {
                  description: true,
                  ocrTexts: true,
                  postCategory: { select: { name: true } }
                }
              }
            },
            take: 5
          }
        }
      })

      if (project?.posts?.length) {
        const postDescriptions = project.posts
          .map(p => {
            const desc = p.post.description || ''
            const category = p.post.postCategory?.name || ''
            return `- ${desc}${category ? ` (Category: ${category})` : ''}`
          })
          .join('\n')
        referenceContext = `\n\nReference posts in the project:\n${postDescriptions}`
      }
    }

    // Build concept options for AI
    const conceptOptions = {
      HOOK: hookConcepts.map(c => ({
        id: c.id,
        title: c.title,
        coreMessage: c.coreMessage,
        exampleCount: c._count.examples,
        examples: c.examples.slice(0, 2).map(e => e.text.substring(0, 100))
      })),
      CONTENT: contentConcepts.map(c => ({
        id: c.id,
        title: c.title,
        coreMessage: c.coreMessage,
        exampleCount: c._count.examples,
        examples: c.examples.slice(0, 2).map(e => e.text.substring(0, 100))
      })),
      CTA: ctaConcepts.map(c => ({
        id: c.id,
        title: c.title,
        coreMessage: c.coreMessage,
        exampleCount: c._count.examples,
        examples: c.examples.slice(0, 2).map(e => e.text.substring(0, 100))
      }))
    }

    // Use AI to suggest best concepts for each slide
    const prompt = `You are helping create a carousel/slideshow about: "${topic}"
${referenceContext}

The carousel has ${numSlides} slides with this structure:
${slideStructure.map(s => `- Slide ${s.slideIndex + 1}: ${s.type}`).join('\n')}

Available concepts to choose from:

HOOK concepts (for opening slide):
${JSON.stringify(conceptOptions.HOOK, null, 2)}

CONTENT concepts (for body slides):
${JSON.stringify(conceptOptions.CONTENT, null, 2)}

CTA concepts (for closing slide):
${JSON.stringify(conceptOptions.CTA, null, 2)}

For each slide, select the most appropriate concept that:
1. Fits the topic "${topic}"
2. Creates a logical flow from hook → content → CTA
3. Uses different CONTENT concepts for variety (don't repeat the same concept)

Respond with a JSON array of suggestions:
[
  {
    "slideIndex": 0,
    "type": "HOOK",
    "conceptId": "concept-id-here",
    "conceptTitle": "concept title",
    "reason": "Brief reason why this concept fits"
  },
  ...
]

If a slide type has no available concepts, use null for conceptId.
Only respond with the JSON array, no other text.`

    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
    })

    const responseText = response.text || ''

    // Parse AI response
    let suggestions: ConceptSuggestion[] = []
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Failed to parse AI suggestions:', parseError)
      // Fallback: suggest first available concept of each type
      suggestions = slideStructure.map(s => {
        const typeConceptList = s.type === 'HOOK' ? hookConcepts :
          s.type === 'CTA' ? ctaConcepts : contentConcepts
        const concept = typeConceptList[0]
        return {
          slideIndex: s.slideIndex,
          type: s.type,
          conceptId: concept?.id || null,
          conceptTitle: concept?.title || null,
          reason: 'Fallback suggestion'
        }
      })
    }

    // Validate suggestions have valid concept IDs
    const validConceptIds = new Set(concepts.map(c => c.id))
    suggestions = suggestions.map(s => {
      if (s.conceptId && !validConceptIds.has(s.conceptId)) {
        // Invalid concept ID, find a fallback
        const typeConceptList = s.type === 'HOOK' ? hookConcepts :
          s.type === 'CTA' ? ctaConcepts : contentConcepts
        const fallback = typeConceptList[0]
        return {
          ...s,
          conceptId: fallback?.id || null,
          conceptTitle: fallback?.title || null,
          reason: 'Fallback suggestion'
        }
      }
      return s
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error suggesting concepts:', error)
    return NextResponse.json(
      { error: 'Failed to suggest concepts' },
      { status: 500 }
    )
  }
}
