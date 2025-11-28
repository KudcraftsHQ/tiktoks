import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI, Type } from '@google/genai'

const prisma = new PrismaClient()

// Schema for split analysis AI output
const SPLIT_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    canSplit: {
      type: Type.BOOLEAN,
      description: "Whether the concept can be meaningfully split"
    },
    reasoning: {
      type: Type.STRING,
      description: "Explanation of why split can or cannot happen"
    },
    splits: {
      type: Type.ARRAY,
      description: "Proposed sub-concepts",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Focused title for this sub-concept (2-5 words)"
          },
          coreMessage: {
            type: Type.STRING,
            description: "One sentence core message for this sub-concept"
          },
          exampleIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "IDs of examples that belong to this sub-concept"
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence score 0-1 for how distinct this pattern is"
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief explanation of this sub-pattern"
          }
        },
        required: ['title', 'coreMessage', 'exampleIds', 'confidence', 'reasoning']
      }
    }
  },
  required: ['canSplit', 'splits'],
  propertyOrdering: ['canSplit', 'reasoning', 'splits']
}

interface SplitProposal {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  exampleIds: string[]
  examples: Array<{ id: string; text: string }>
  confidence: number
  reasoning: string
}

interface ExecuteSplit {
  title: string
  coreMessage: string
  exampleIds: string[]
}

// POST /api/concepts/[id]/split - Split concept into multiple sub-concepts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conceptId } = await params
    const body = await request.json()

    const {
      minimumExamplesPerSplit = 2,
      maxSplits = 5,
      executeImmediately = false,
      splits,
      deleteOriginal = false
    } = body

    // Fetch concept with examples
    const concept = await prisma.conceptBank.findUnique({
      where: { id: conceptId },
      include: {
        examples: {
          select: {
            id: true,
            text: true,
            sourceType: true,
            sourcePostId: true,
            sourceSlideIndex: true
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

    // Validate minimum examples
    if (concept.examples.length < 4) {
      return NextResponse.json({
        success: false,
        canSplit: false,
        error: 'Need at least 4 examples to split',
        splits: []
      })
    }

    // PREVIEW MODE: Analyze and return split proposals
    if (!executeImmediately) {
      const analysis = await analyzeSplitsWithAI(
        concept,
        minimumExamplesPerSplit,
        maxSplits
      )

      if (!analysis.canSplit) {
        return NextResponse.json({
          success: true,
          canSplit: false,
          message: analysis.reasoning || 'Concept is already well-focused - no meaningful splits detected',
          splits: []
        })
      }

      // Format splits for response
      const splitProposals: SplitProposal[] = analysis.splits.map((split, index) => ({
        id: `temp-${index}`, // Temporary client ID
        title: split.title,
        coreMessage: split.coreMessage,
        type: concept.type, // Inherit parent type
        exampleIds: split.exampleIds,
        examples: concept.examples.filter(ex => split.exampleIds.includes(ex.id)),
        confidence: split.confidence,
        reasoning: split.reasoning
      }))

      return NextResponse.json({
        success: true,
        canSplit: true,
        splits: splitProposals,
        warnings: [],
        originalConceptId: conceptId
      })
    }

    // EXECUTION MODE: Create new concepts and move examples
    if (!splits || !Array.isArray(splits)) {
      return NextResponse.json(
        { error: 'Splits array required for execution' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdConceptIds: string[] = []
      let totalExamplesMoved = 0

      // Create new concepts and move examples
      for (const split of splits as ExecuteSplit[]) {
        // Validate split has examples
        if (!split.exampleIds || split.exampleIds.length === 0) {
          continue
        }

        // Create new concept
        const newConcept = await tx.conceptBank.create({
          data: {
            title: split.title,
            coreMessage: split.coreMessage,
            type: concept.type, // Inherit parent type
            isActive: true,
            timesUsed: 0
          }
        })

        // Move examples to new concept
        await tx.conceptExample.updateMany({
          where: {
            id: { in: split.exampleIds },
            conceptId: conceptId // Ensure examples belong to source concept
          },
          data: {
            conceptId: newConcept.id
          }
        })

        createdConceptIds.push(newConcept.id)
        totalExamplesMoved += split.exampleIds.length
      }

      // Check remaining examples in original concept
      const remainingExamples = await tx.conceptExample.count({
        where: { conceptId: conceptId }
      })

      // Delete original concept (always delete per user preference)
      if (remainingExamples === 0 || deleteOriginal) {
        await tx.conceptBank.delete({
          where: { id: conceptId }
        })
      }

      return {
        conceptsCreated: createdConceptIds.length,
        examplesMoved: totalExamplesMoved,
        originalConceptStatus: (remainingExamples === 0 || deleteOriginal) ? 'deleted' : 'kept'
      }
    })

    return NextResponse.json({
      success: true,
      conceptsCreated: result.conceptsCreated,
      examplesMoved: result.examplesMoved,
      originalConceptStatus: result.originalConceptStatus
    })

  } catch (error) {
    console.error('Failed to split concept:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to split concept' },
      { status: 500 }
    )
  }
}

// AI analysis helper
async function analyzeSplitsWithAI(
  concept: {
    id: string
    title: string
    coreMessage: string
    type: 'HOOK' | 'CONTENT' | 'CTA'
    examples: Array<{ id: string; text: string }>
  },
  minExamples: number,
  maxSplits: number
): Promise<{
  canSplit: boolean
  reasoning?: string
  splits: Array<{
    title: string
    coreMessage: string
    exampleIds: string[]
    confidence: number
    reasoning: string
  }>
}> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  })

  // Build examples list
  const examplesList = concept.examples.map(ex =>
    `[Example ID: ${ex.id}] "${ex.text}"`
  ).join('\n\n')

  const prompt = `You are analyzing a content concept to identify distinct sub-patterns for splitting.

## CRITICAL CONSTRAINTS
- All splits MUST be type: ${concept.type}
- Each split needs EXACTLY ${minExamples} or MORE examples
- Create MAXIMUM ${maxSplits} splits
- ALL examples must be assigned (no leftovers)
- Only split if examples have MEANINGFULLY DIFFERENT sub-patterns
- If examples are very similar, return canSplit: false

## Original Concept
Title: ${concept.title}
Type: ${concept.type}
Core Message: ${concept.coreMessage}

## Examples to Analyze (${concept.examples.length} total)
${examplesList}

## Your Task
1. Identify distinct sub-patterns within these examples
2. Group ALL examples by sub-pattern (minimum ${minExamples} per group)
3. Create a focused title and core message for each sub-pattern
4. Assign confidence score (0-1) based on pattern distinctness
5. Provide reasoning for each split

If no meaningful sub-patterns exist, set canSplit: false and explain why in reasoning.
Return splits array sorted by confidence (highest first).

IMPORTANT: Every example ID must appear in exactly one split's exampleIds array.`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: SPLIT_ANALYSIS_SCHEMA,
      },
    })

    if (!response.text) {
      throw new Error('No response from Gemini AI')
    }

    const parsed = JSON.parse(response.text)

    // Validate that all examples are assigned
    const assignedExampleIds = new Set<string>()
    for (const split of (parsed.splits || [])) {
      for (const exampleId of split.exampleIds) {
        assignedExampleIds.add(exampleId)
      }
    }

    // If not all examples assigned, mark as can't split
    if (assignedExampleIds.size !== concept.examples.length) {
      return {
        canSplit: false,
        reasoning: 'AI could not confidently group all examples into distinct patterns',
        splits: []
      }
    }

    return {
      canSplit: parsed.canSplit ?? true,
      reasoning: parsed.reasoning,
      splits: parsed.splits || []
    }
  } catch (error) {
    console.error('AI split analysis failed:', error)
    throw new Error('AI service unavailable. Please try again later.')
  }
}
