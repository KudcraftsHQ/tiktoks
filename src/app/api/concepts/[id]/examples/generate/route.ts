import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI, Type } from '@google/genai'

const prisma = new PrismaClient()

// Schema for AI-generated example variations
const EXAMPLE_GENERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    variations: {
      type: Type.ARRAY,
      description: 'Array of generated example variations',
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: 'The generated example copy text'
          },
          rationale: {
            type: Type.STRING,
            description: 'Brief explanation of the approach taken for this variation'
          }
        },
        propertyOrdering: ['text', 'rationale']
      }
    }
  },
  propertyOrdering: ['variations']
}

type GenerationMode = 'paraphrase' | 'change_angle' | 'fresh_take'

interface GenerateRequest {
  mode: GenerationMode
  customPrompt?: string
  variationCount: number
}

interface GenerationResult {
  variations: Array<{
    text: string
    rationale: string
  }>
}

function buildPrompt(
  concept: {
    title: string
    coreMessage: string
    type: string
  },
  existingExamples: string[],
  mode: GenerationMode,
  customPrompt: string | undefined,
  variationCount: number
): string {
  const modeInstructions = {
    paraphrase: `Paraphrase the existing examples while maintaining the same core message and intent.
Keep the same angle but use different wording, phrasing, and sentence structure.
The meaning should be preserved but expressed in a fresh way.`,
    change_angle: `Create variations that express the same core concept but from a different perspective or angle.
For example, if the original is written from personal experience, try a universal truth angle.
Or if it's a statement, turn it into a question or challenge.
Keep the essence but shift the framing.`,
    fresh_take: `Generate completely new examples that capture the concept's essence but with original creative approaches.
You can use different rhetorical devices, storytelling techniques, or presentation styles.
Be creative while staying true to the core message.`
  }

  const typeContext = {
    HOOK: 'This is a HOOK concept - used for opening slides to grab attention. Keep it punchy, provocative, and scroll-stopping.',
    CONTENT: 'This is a CONTENT concept - used for body slides that deliver value. Keep it clear, insightful, and easy to digest.',
    CTA: 'This is a CTA concept - used for closing slides to drive action. Keep it actionable, compelling, and leave an impression.'
  }

  return `You are an expert content writer specializing in viral social media carousel content.

## Task
Generate ${variationCount} new example${variationCount > 1 ? 's' : ''} for a content concept.

## Concept Details
- **Title**: ${concept.title}
- **Core Message**: ${concept.coreMessage}
- **Type**: ${concept.type}

${typeContext[concept.type as keyof typeof typeContext] || ''}

## Existing Examples for Reference
${existingExamples.length > 0
  ? existingExamples.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')
  : 'No existing examples yet. Generate based on the concept title and core message.'}

## Generation Mode
${modeInstructions[mode]}

${customPrompt ? `## Additional Instructions\n${customPrompt}` : ''}

## Guidelines
- Write in a conversational, relatable tone
- Keep each example concise (1-4 sentences typically)
- Each variation should feel distinct from the others
- Match the energy and style of successful carousel content
- Avoid generic or corporate-sounding language
- Do NOT include slide numbers or bullet points
- Write the actual copy as it would appear on a slide

Generate ${variationCount} unique variation${variationCount > 1 ? 's' : ''}.`
}

// POST /api/concepts/[id]/examples/generate - Generate examples with AI
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conceptId } = await params
    const body: GenerateRequest = await request.json()

    const { mode, customPrompt, variationCount } = body

    // Validate inputs
    if (!mode || !['paraphrase', 'change_angle', 'fresh_take'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be one of: paraphrase, change_angle, fresh_take' },
        { status: 400 }
      )
    }

    if (!variationCount || variationCount < 1 || variationCount > 5) {
      return NextResponse.json(
        { error: 'variationCount must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Fetch concept with existing examples
    const concept = await prisma.conceptBank.findUnique({
      where: { id: conceptId },
      include: {
        examples: {
          orderBy: { createdAt: 'desc' },
          take: 10 // Use up to 10 recent examples as reference
        }
      }
    })

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      )
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    // Build prompt
    const existingExampleTexts = concept.examples.map(ex => ex.text)
    const prompt = buildPrompt(
      {
        title: concept.title,
        coreMessage: concept.coreMessage,
        type: concept.type
      },
      existingExampleTexts,
      mode,
      customPrompt,
      variationCount
    )

    // Call Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: EXAMPLE_GENERATION_SCHEMA,
      },
    })

    const responseText = response.text
    if (!responseText) {
      return NextResponse.json(
        { error: 'AI returned empty response' },
        { status: 500 }
      )
    }

    const result: GenerationResult = JSON.parse(responseText)

    return NextResponse.json({
      variations: result.variations,
      concept: {
        id: concept.id,
        title: concept.title,
        coreMessage: concept.coreMessage,
        type: concept.type
      }
    })
  } catch (error) {
    console.error('Failed to generate examples:', error)
    return NextResponse.json(
      { error: 'Failed to generate examples' },
      { status: 500 }
    )
  }
}
