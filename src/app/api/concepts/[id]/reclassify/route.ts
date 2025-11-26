import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI, Type } from '@google/genai'

const prisma = new PrismaClient()

// Schema for reclassification AI output
const RECLASSIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    classifications: {
      type: Type.ARRAY,
      description: "Classification decision for each example",
      items: {
        type: Type.OBJECT,
        properties: {
          exampleId: {
            type: Type.STRING,
            description: "ID of the example being classified"
          },
          bestConceptId: {
            type: Type.STRING,
            description: "ID of the concept this example fits best (may be current concept)"
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence score 0-1 for this classification"
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief explanation for why this concept is the best fit"
          }
        },
        propertyOrdering: ['exampleId', 'bestConceptId', 'confidence', 'reasoning']
      }
    }
  },
  propertyOrdering: ['classifications']
}

interface Classification {
  exampleId: string
  bestConceptId: string
  confidence: number
  reasoning: string
  slideIndexViolation?: boolean
}

interface ExampleWithSource {
  id: string
  text: string
  sourceSlideIndex: number
  sourceType: string
}

interface ConceptWithCount {
  id: string
  title: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  coreMessage: string
  _count: { examples: number }
}

// POST /api/concepts/[id]/reclassify - Reclassify examples using AI
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conceptId } = await params

    // Fetch concept with SLIDE-sourced examples only
    const concept = await prisma.conceptBank.findUnique({
      where: { id: conceptId },
      include: {
        examples: {
          where: {
            sourceType: 'SLIDE', // Only process slide-sourced examples
            sourceSlideIndex: { not: null }
          }
        }
      }
    })

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      )
    }

    if (concept.examples.length === 0) {
      return NextResponse.json(
        { error: 'No slide-sourced examples to reclassify' },
        { status: 400 }
      )
    }

    // Fetch all active concepts for comparison
    const allConcepts = await prisma.conceptBank.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { examples: true } }
      }
    })

    // Call AI classification service
    const classifications = await classifyExamplesWithAI(
      concept,
      concept.examples as ExampleWithSource[],
      allConcepts as ConceptWithCount[]
    )

    // Validate slide 1 rule and execute moves in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create maps for quick lookup
      const examplesMap = new Map(
        concept.examples.map(ex => [ex.id, ex as ExampleWithSource])
      )
      const conceptsMap = new Map(
        allConcepts.map(c => [c.id, c as ConceptWithCount])
      )

      // Validate and correct slide 1 CTA violations
      const validatedClassifications = classifications.map(classification => {
        const example = examplesMap.get(classification.exampleId)
        if (!example) return classification

        const targetConcept = conceptsMap.get(classification.bestConceptId)
        if (!targetConcept) return classification

        // CRITICAL: If example is from slide 1 and target is CTA, override
        if (example.sourceSlideIndex === 0 && targetConcept.type === 'CTA') {
          // Find best non-CTA alternative
          const hookConcepts = allConcepts.filter(c => c.type === 'HOOK' && c.id !== conceptId)
          const contentConcepts = allConcepts.filter(c => c.type === 'CONTENT' && c.id !== conceptId)

          const alternative = hookConcepts[0] || contentConcepts[0]

          if (alternative) {
            return {
              ...classification,
              bestConceptId: alternative.id,
              slideIndexViolation: true,
              reasoning: `Original classification violated slide 1 rule (cannot be CTA). Reassigned to ${alternative.type}.`
            }
          } else {
            // No alternatives - keep in current concept
            return {
              ...classification,
              bestConceptId: conceptId,
              slideIndexViolation: true,
              reasoning: "Slide 1 cannot be CTA. No suitable HOOK/CONTENT concept found. Kept in current concept."
            }
          }
        }

        return classification
      })

      // Filter moves: only include if different concept AND confidence >= 0.6
      const movesToExecute = validatedClassifications.filter(
        c => c.bestConceptId !== conceptId && c.confidence >= 0.6
      )

      // Group by target concept
      const movementsByTarget = new Map<string, string[]>()
      for (const classification of movesToExecute) {
        if (!movementsByTarget.has(classification.bestConceptId)) {
          movementsByTarget.set(classification.bestConceptId, [])
        }
        movementsByTarget.get(classification.bestConceptId)!.push(classification.exampleId)
      }

      // Execute bulk moves
      for (const [targetConceptId, exampleIds] of movementsByTarget.entries()) {
        await tx.conceptExample.updateMany({
          where: { id: { in: exampleIds } },
          data: { conceptId: targetConceptId }
        })
      }

      // Check if source concept now has zero examples
      const remainingExamples = await tx.conceptExample.count({
        where: { conceptId: conceptId }
      })

      // Build movement details for response
      const movements = movesToExecute.map(c => {
        const example = examplesMap.get(c.exampleId)!
        const targetConcept = conceptsMap.get(c.bestConceptId)!
        return {
          exampleId: c.exampleId,
          exampleText: example.text.substring(0, 100) + (example.text.length > 100 ? '...' : ''),
          fromConceptId: conceptId,
          toConceptId: c.bestConceptId,
          toConceptTitle: targetConcept.title,
          confidence: c.confidence,
          reasoning: c.reasoning
        }
      })

      return {
        movements,
        remainingExamples,
        movementsByTarget,
        validatedClassifications
      }
    })

    // Build response
    const warnings: string[] = []
    if (result.remainingExamples === 0) {
      warnings.push('empty')
    }

    const conceptsAffected = Array.from(result.movementsByTarget.keys())

    return NextResponse.json({
      success: true,
      summary: {
        totalExamples: concept.examples.length,
        examplesMoved: result.movements.length,
        examplesKept: concept.examples.length - result.movements.length,
        conceptsAffected
      },
      movements: result.movements,
      warnings
    })
  } catch (error) {
    console.error('Failed to reclassify examples:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reclassify examples' },
      { status: 500 }
    )
  }
}

// AI classification helper
async function classifyExamplesWithAI(
  currentConcept: { id: string; title: string; type: string; coreMessage: string },
  examples: ExampleWithSource[],
  allConcepts: ConceptWithCount[]
): Promise<Classification[]> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  })

  // Build examples list with slide 1 warnings
  const examplesList = examples.map(ex => {
    const slideWarning = ex.sourceSlideIndex === 0 ? ' ⚠️ SLIDE 1 - CANNOT BE CTA' : ''
    return `[Example ID: ${ex.id}]
Text: "${ex.text}"
Source: Slide ${ex.sourceSlideIndex}${slideWarning}`
  }).join('\n\n')

  // Build concepts list
  const conceptsList = allConcepts.map(c => {
    return `[Concept ID: ${c.id}]
Title: ${c.title}
Type: ${c.type}
Core Message: ${c.coreMessage}
Example Count: ${c._count.examples}`
  }).join('\n\n')

  const prompt = `You are an expert content analyst specializing in viral TikTok carousel patterns.

## Task
Analyze each example and determine which existing concept it belongs to best.

## CRITICAL RULE
**Slide 1 (slideIndex: 0) can NEVER be classified as CTA**.
- If an example is from slideIndex 0, it MUST be either HOOK or CONTENT, never CTA.
- This is a hard constraint - override any other classification logic for slide 1.

## Current Concept Being Reclassified
- ID: ${currentConcept.id}
- Title: ${currentConcept.title}
- Core Message: ${currentConcept.coreMessage}
- Type: ${currentConcept.type}

## Examples to Classify
${examplesList}

## All Available Concepts
${conceptsList}

## Your Task
For each example:
1. Determine which concept (including the current one) best matches its content
2. Consider the example's type, messaging, and purpose
3. **ENFORCE: If sourceSlideIndex is 0, the concept MUST NOT be CTA type**
4. Provide a confidence score (0-1) and reasoning
5. If the current concept is still a good fit or no better option exists, assign to current concept with appropriate confidence

Return a classification for each example.`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RECLASSIFICATION_SCHEMA,
      },
    })

    if (!response.text) {
      throw new Error('No response from Gemini AI')
    }

    const parsed = JSON.parse(response.text)
    return parsed.classifications || []
  } catch (error) {
    console.error('AI classification failed:', error)
    throw new Error('AI service unavailable. Please try again later.')
  }
}
