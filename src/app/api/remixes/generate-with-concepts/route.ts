import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

const prisma = new PrismaClient()

// Schema for the request
const generateWithConceptsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  topic: z.string().min(1, 'Topic is required'),
  languageStyle: z.string().default('casual, conversational, lowercase'),
  slides: z.array(z.object({
    slideIndex: z.number(),
    type: z.enum(['HOOK', 'CONTENT', 'CTA']),
    conceptId: z.string().nullable() // null means "Let AI decide"
  })).min(3, 'At least 3 slides required')
})

// Structured output schema for Gemini
const CONCEPT_DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    slides: {
      type: Type.ARRAY,
      description: "Generated slides in order",
      items: {
        type: Type.OBJECT,
        properties: {
          slideIndex: {
            type: Type.NUMBER,
            description: "Zero-based index of the slide"
          },
          slideType: {
            type: Type.STRING,
            enum: ['HOOK', 'CONTENT', 'CTA'],
            description: "Type of slide"
          },
          text: {
            type: Type.STRING,
            description: "The generated text content for this slide"
          },
          conceptId: {
            type: Type.STRING,
            description: "The concept ID used for this slide (if any)"
          },
          conceptTitle: {
            type: Type.STRING,
            description: "The concept title used (if any)"
          }
        },
        propertyOrdering: ['slideIndex', 'slideType', 'text', 'conceptId', 'conceptTitle']
      }
    },
    metadata: {
      type: Type.OBJECT,
      description: "Metadata about the generated draft",
      properties: {
        title: {
          type: Type.STRING,
          description: "A short, catchy title for this draft (3-8 words)"
        },
        description: {
          type: Type.STRING,
          description: "A cohesive narrative summary of all slides as one flowing story"
        },
        totalSlides: {
          type: Type.NUMBER,
          description: "Total number of slides"
        }
      },
      propertyOrdering: ['title', 'description', 'totalSlides']
    }
  },
  propertyOrdering: ['slides', 'metadata']
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, topic, languageStyle, slides } = generateWithConceptsSchema.parse(body)

    console.log(`📝 [API] Starting concept-based draft generation`)
    console.log(`   Topic: ${topic}`)
    console.log(`   Slides: ${slides.length}`)

    // Fetch the project with reference posts
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        posts: {
          include: {
            post: {
              select: {
                id: true,
                description: true,
                ocrTexts: true,
                imageDescriptions: true,
                slideClassifications: true,
                postCategory: { select: { name: true } }
              }
            }
          },
          take: 5
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Collect all concept IDs that need to be fetched
    const conceptIds = slides
      .filter(s => s.conceptId)
      .map(s => s.conceptId as string)

    // Fetch selected concepts with their examples
    const concepts = conceptIds.length > 0
      ? await prisma.conceptBank.findMany({
          where: {
            id: { in: conceptIds },
            isActive: true
          },
          include: {
            examples: {
              take: 3,
              orderBy: { createdAt: 'desc' }
            }
          }
        })
      : []

    // Create a map for easy lookup
    const conceptMap = new Map(concepts.map(c => [c.id, c]))

    // For slides without a concept, fetch available concepts of that type
    const typesNeedingConcepts = [...new Set(
      slides.filter(s => !s.conceptId).map(s => s.type)
    )]

    const availableConceptsByType: Record<string, typeof concepts> = {}
    if (typesNeedingConcepts.length > 0) {
      const availableConcepts = await prisma.conceptBank.findMany({
        where: {
          type: { in: typesNeedingConcepts },
          isActive: true
        },
        include: {
          examples: {
            take: 2,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { timesUsed: 'desc' }
      })

      for (const type of typesNeedingConcepts) {
        availableConceptsByType[type] = availableConcepts.filter(c => c.type === type)
      }
    }

    // Build reference posts context
    let referenceContext = ''
    if (project.posts.length > 0) {
      const postContexts = project.posts.map((p, idx) => {
        const post = p.post
        const ocrTexts = typeof post.ocrTexts === 'string'
          ? JSON.parse(post.ocrTexts)
          : post.ocrTexts

        const ocrText = Array.isArray(ocrTexts)
          ? ocrTexts
              .filter((t: any) => t.success && t.text)
              .map((t: any) => `  Slide ${t.imageIndex + 1}: ${t.text}`)
              .join('\n')
          : ''

        return `Reference Post ${idx + 1}:
- Category: ${post.postCategory?.name || 'Uncategorized'}
- Description: ${post.description || 'No description'}
- Content:
${ocrText || '  No text extracted'}`
      }).join('\n\n')

      referenceContext = `\n**REFERENCE POSTS FOR STYLE:**
Study these posts for tone, voice, and style. Mirror their casual, authentic energy.

${postContexts}\n`
    }

    // Build slide structure with concepts
    const slideStructure = slides.map(slide => {
      const concept = slide.conceptId ? conceptMap.get(slide.conceptId) : null
      const available = !concept ? (availableConceptsByType[slide.type] || []) : []

      return {
        slideIndex: slide.slideIndex,
        type: slide.type,
        concept: concept ? {
          id: concept.id,
          title: concept.title,
          coreMessage: concept.coreMessage,
          examples: concept.examples.map(e => e.text)
        } : null,
        availableConcepts: available.slice(0, 3).map(c => ({
          id: c.id,
          title: c.title,
          coreMessage: c.coreMessage,
          examples: c.examples.map(e => e.text)
        }))
      }
    })

    // Build the prompt
    const prompt = buildConceptDraftPrompt({
      topic,
      languageStyle,
      slideStructure,
      referenceContext
    })

    // Initialize Gemini AI
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    console.log(`🤖 [API] Calling Gemini for concept-based generation...`)

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: CONCEPT_DRAFT_SCHEMA,
      },
    })

    if (!response.text) {
      throw new Error('No response from Gemini AI')
    }

    console.log(`✅ [API] Received response from Gemini`)

    // Parse the response
    const generationResult = JSON.parse(response.text)

    // Build slides array in RemixPost format
    const remixSlides = generationResult.slides.map((slide: any) => ({
      id: crypto.randomUUID(),
      displayOrder: slide.slideIndex,
      paraphrasedText: slide.text,
      originalText: '',
      canvas: {
        width: 1080,
        height: 1920,
        unit: 'px',
      },
      backgroundLayers: [],
      textBoxes: [],
      viewport: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      },
    }))

    // Build slide classifications with concept references
    const slideClassifications = generationResult.slides.map((slide: any) => ({
      slideIndex: slide.slideIndex,
      type: slide.slideType,
      categoryName: generationResult.metadata.title,
      conceptId: slide.conceptId || null,
      conceptTitle: slide.conceptTitle || null
    }))

    // Create the draft RemixPost
    const draft = await prisma.remixPost.create({
      data: {
        name: generationResult.metadata.title,
        description: generationResult.metadata.description,
        generationType: 'ai_concept_guided',
        sourcePostIds: project.posts.map(p => p.post.id),
        projectId: projectId,
        languageStyleTags: [languageStyle],
        generationPrompt: `Topic: ${topic}\nSlide concepts: ${slideStructure.map(s => s.concept?.title || 'AI decided').join(' → ')}`,
        isDraft: true,
        slides: remixSlides,
        slideClassifications: slideClassifications,
      },
    })

    // Update concept usage counts
    const usedConceptIds = generationResult.slides
      .filter((s: any) => s.conceptId)
      .map((s: any) => s.conceptId)

    if (usedConceptIds.length > 0) {
      await prisma.conceptBank.updateMany({
        where: { id: { in: usedConceptIds } },
        data: {
          timesUsed: { increment: 1 },
          lastUsedAt: new Date()
        }
      })
    }

    console.log(`✅ [API] Created draft: ${draft.id}`)

    return NextResponse.json({
      remix: draft,
      slideConceptMapping: slideClassifications
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('❌ [API] Concept-based generation failed:', error)

    Sentry.captureException(error, {
      tags: { operation: 'concept_draft_generation' },
    })

    return NextResponse.json(
      {
        error: 'Failed to generate draft',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

interface PromptConfig {
  topic: string
  languageStyle: string
  slideStructure: Array<{
    slideIndex: number
    type: string
    concept: {
      id: string
      title: string
      coreMessage: string
      examples: string[]
    } | null
    availableConcepts: Array<{
      id: string
      title: string
      coreMessage: string
      examples: string[]
    }>
  }>
  referenceContext: string
}

function buildConceptDraftPrompt(config: PromptConfig): string {
  const { topic, languageStyle, slideStructure, referenceContext } = config

  const slidesDescription = slideStructure.map(slide => {
    if (slide.concept) {
      // User selected a specific concept
      return `
**Slide ${slide.slideIndex + 1} (${slide.type})** - USE THIS CONCEPT:
- Concept: "${slide.concept.title}"
- Core Message: ${slide.concept.coreMessage}
- Example copy to inspire you:
${slide.concept.examples.map(e => `  • "${e}"`).join('\n')}
- You MUST incorporate this concept's essence while adapting it to the topic.
- Return conceptId: "${slide.concept.id}" and conceptTitle: "${slide.concept.title}" in your response.`
    } else if (slide.availableConcepts.length > 0) {
      // AI should choose from available concepts
      return `
**Slide ${slide.slideIndex + 1} (${slide.type})** - CHOOSE A CONCEPT:
Pick the most fitting concept from these options:
${slide.availableConcepts.map((c, i) => `  ${i + 1}. "${c.title}" - ${c.coreMessage}
     Examples: ${c.examples.slice(0, 2).map(e => `"${e.substring(0, 60)}..."`).join(', ')}
     (conceptId: "${c.id}")`).join('\n')}
- Choose whichever fits best for the topic and flow.
- Return the chosen conceptId and conceptTitle in your response.`
    } else {
      // No concepts available, AI creates freely
      return `
**Slide ${slide.slideIndex + 1} (${slide.type})** - CREATE FREELY:
- No specific concept assigned.
- Create content that fits the ${slide.type} pattern naturally.
- Leave conceptId and conceptTitle empty in your response.`
    }
  }).join('\n')

  return `You are creating a TikTok carousel about: "${topic}"

**YOUR TASK:**
Generate content for ${slideStructure.length} slides, using the specified concepts for each slide.
The concepts provide the PATTERN and MESSAGE - adapt them to fit the TOPIC.
${referenceContext}
**SLIDE STRUCTURE:**
${slidesDescription}

**LANGUAGE STYLE:**
${languageStyle}

**CRITICAL RULES FOR FLOW:**

1. **COHESIVE NARRATIVE**: All slides must flow as one story. Each slide should naturally lead to the next.

2. **SLIDE TYPE PATTERNS:**
   - HOOK: Create curiosity gap, establish authority, end with "heres what..." pattern
   - CONTENT: Bold statement → Why it matters → Personal reaction (use "i" lowercase)
   - CTA: If last slide, provide satisfying closure. If product mention needed, keep it authentic.

3. **AUTHENTICITY (CRITICAL):**
   - Always lowercase "i" (never "I")
   - Drop apostrophes: "heres", "ive", "dont", "youre", "thats"
   - Use casual grammar - write like texting a friend
   - Include authenticity markers: "honestly", "literally", "ngl", "i swear"
   - Emojis only at end of slides if appropriate: 🫶💗🥺✨

4. **CONCEPT ADAPTATION:**
   - Don't copy examples literally - use them as PATTERNS
   - Adapt the core message to fit "${topic}"
   - Maintain the essence while making it fresh

5. **OPEN LOOPS:**
   - Each slide should create curiosity for the next
   - Never reveal everything in one slide
   - Build anticipation throughout

Generate the draft now. Make it feel authentic, like a real creator sharing insights - not marketing copy.`
}
