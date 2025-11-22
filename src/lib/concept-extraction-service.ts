import { GoogleGenAI, Type } from '@google/genai'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// Schema for concept extraction
const CONCEPT_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    concepts: {
      type: Type.ARRAY,
      description: "Extracted concepts from the slides",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Short title (2-5 words) naming the pattern or concept"
          },
          coreMessage: {
            type: Type.STRING,
            description: "One sentence explaining the underlying lesson or pattern"
          },
          type: {
            type: Type.STRING,
            enum: ['HOOK', 'CONTENT', 'CTA'],
            description: "Type of concept: HOOK (opening), CONTENT (body/teaching), or CTA (closing/action)"
          },
          slideIndices: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Zero-indexed list of slides that belong to this concept"
          }
        },
        propertyOrdering: ['title', 'coreMessage', 'type', 'slideIndices']
      }
    }
  },
  propertyOrdering: ['concepts']
}

interface SlideContent {
  slideIndex: number
  text: string
  slideType: 'hook' | 'content' | 'cta' | null
  postId: string
}

interface ExtractedConcept {
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  exampleText: string
  sourcePostId: string
  sourceSlideIndex: number
}

interface ExtractionResult {
  conceptsCreated: number
  examplesAdded: number
  errors: string[]
}

/**
 * Extract concepts from posts using AI
 * Groups similar slide content into concepts with examples
 */
export async function extractConceptsFromPosts(postIds: string[]): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    conceptsCreated: 0,
    examplesAdded: 0,
    errors: []
  }

  // Fetch posts with OCR data
  const posts = await prisma.tiktokPost.findMany({
    where: {
      id: { in: postIds },
      ocrStatus: 'completed'
    },
    select: {
      id: true,
      ocrTexts: true,
      slideClassifications: true
    }
  })

  if (posts.length === 0) {
    result.errors.push('No posts with completed OCR found')
    return result
  }

  // Collect all slides from all posts
  const allSlides: SlideContent[] = []

  for (const post of posts) {
    // Parse OCR texts
    let ocrTexts: Array<{ imageIndex: number; text: string; success: boolean }> = []
    try {
      if (post.ocrTexts) {
        const parsed = typeof post.ocrTexts === 'string'
          ? JSON.parse(post.ocrTexts)
          : post.ocrTexts
        ocrTexts = Array.isArray(parsed) ? parsed : []
      }
    } catch {
      continue
    }

    // Parse slide classifications
    let classifications: Array<{ slideIndex: number; slideType: string }> = []
    try {
      if (post.slideClassifications) {
        const parsed = typeof post.slideClassifications === 'string'
          ? JSON.parse(post.slideClassifications)
          : post.slideClassifications
        classifications = Array.isArray(parsed) ? parsed : []
      }
    } catch {
      classifications = []
    }

    // Combine OCR text with classification
    for (const ocr of ocrTexts) {
      if (!ocr.success || !ocr.text?.trim()) continue

      const classification = classifications.find(c => c.slideIndex === ocr.imageIndex)
      const slideType = classification?.slideType as 'hook' | 'content' | 'cta' | null

      allSlides.push({
        slideIndex: ocr.imageIndex,
        text: ocr.text.trim(),
        slideType,
        postId: post.id
      })
    }
  }

  if (allSlides.length === 0) {
    result.errors.push('No slides with text found in selected posts')
    return result
  }

  // Use AI to extract concepts from slides
  const extractedConcepts = await extractConceptsWithAI(allSlides)

  // Save concepts to database
  for (const concept of extractedConcepts) {
    try {
      // Check if a similar concept already exists
      const existingConcept = await findSimilarConcept(concept.title, concept.coreMessage)

      if (existingConcept) {
        // Add as example to existing concept
        await prisma.conceptExample.create({
          data: {
            conceptId: existingConcept.id,
            text: concept.exampleText,
            sourceType: 'SLIDE',
            sourcePostId: concept.sourcePostId,
            sourceSlideIndex: concept.sourceSlideIndex
          }
        })
        result.examplesAdded++
      } else {
        // Create new concept with example
        await prisma.conceptBank.create({
          data: {
            title: concept.title,
            coreMessage: concept.coreMessage,
            type: concept.type,
            examples: {
              create: {
                text: concept.exampleText,
                sourceType: 'SLIDE',
                sourcePostId: concept.sourcePostId,
                sourceSlideIndex: concept.sourceSlideIndex
              }
            }
          }
        })
        result.conceptsCreated++
      }
    } catch (error) {
      console.error('Failed to save concept:', error)
      result.errors.push(`Failed to save concept: ${concept.title}`)
    }
  }

  return result
}

async function findSimilarConcept(title: string, coreMessage: string) {
  // First try exact title match
  const exactMatch = await prisma.conceptBank.findFirst({
    where: {
      title: {
        equals: title,
        mode: 'insensitive'
      }
    }
  })

  if (exactMatch) return exactMatch

  // Try fuzzy match on core message (contains key words)
  const words = coreMessage.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  if (words.length === 0) return null

  const similarMatch = await prisma.conceptBank.findFirst({
    where: {
      OR: words.slice(0, 3).map(word => ({
        coreMessage: {
          contains: word,
          mode: 'insensitive' as const
        }
      }))
    }
  })

  return similarMatch
}

async function extractConceptsWithAI(
  slides: SlideContent[]
): Promise<ExtractedConcept[]> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  })

  // Group slides by their pre-classified type for better extraction
  const hookSlides = slides.filter(s => s.slideType === 'hook')
  const contentSlides = slides.filter(s => s.slideType === 'content')
  const ctaSlides = slides.filter(s => s.slideType === 'cta')
  const unknownSlides = slides.filter(s => !s.slideType)

  const prompt = `Analyze these carousel slides and extract reusable content concepts (patterns/lessons).

The slides have ALREADY been classified into types (HOOK, CONTENT, CTA). Use this classification to determine the concept type.

For each unique concept found, provide:
1. A short title (2-5 words) that names the pattern
2. A one-sentence core message explaining the lesson
3. The type: MUST match the slide's pre-classified type (HOOK, CONTENT, or CTA)

**HOOK SLIDES (Opening/Attention-grabbing):**
${hookSlides.length > 0 ? hookSlides.map((s, i) => `[Index ${slides.indexOf(s)}] "${s.text}"`).join('\n') : 'None'}

**CONTENT SLIDES (Body/Teaching):**
${contentSlides.length > 0 ? contentSlides.map((s, i) => `[Index ${slides.indexOf(s)}] "${s.text}"`).join('\n') : 'None'}

**CTA SLIDES (Call-to-Action/Closing):**
${ctaSlides.length > 0 ? ctaSlides.map((s, i) => `[Index ${slides.indexOf(s)}] "${s.text}"`).join('\n') : 'None'}

${unknownSlides.length > 0 ? `**UNCLASSIFIED SLIDES (determine type based on content):**
${unknownSlides.map((s, i) => `[Index ${slides.indexOf(s)}] "${s.text}"`).join('\n')}` : ''}

IMPORTANT RULES:
- Group similar messages into ONE concept (don't create duplicates)
- Extract the underlying PATTERN, not the specific content
- Each concept should be reusable for creating new content
- The concept TYPE must match the slide's pre-classified type
- The slideIndices should reference which slides (0-indexed from the full list) belong to this concept
- Create separate concepts for HOOK, CONTENT, and CTA patterns`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: CONCEPT_EXTRACTION_SCHEMA,
      },
    })

    if (!response.text) {
      console.error('No response from Gemini AI')
      return []
    }

    const parsed = JSON.parse(response.text)
    const concepts = parsed.concepts || []

    // Convert to ExtractedConcept format
    const extractedConcepts: ExtractedConcept[] = []

    // Track which slides have been processed
    const processedSlideIndices = new Set<number>()

    for (const concept of concepts) {
      // Create one concept entry per slide that matches
      const slideIndices = concept.slideIndices || [0]

      for (const slideIdx of slideIndices) {
        const slide = slides[slideIdx]
        if (!slide) continue

        // CRITICAL: Use the slide's actual pre-classified type, not AI-suggested type
        // This ensures concepts are strictly grouped by slide type
        const slideTypeUpper = slide.slideType?.toUpperCase() as 'HOOK' | 'CONTENT' | 'CTA' | undefined
        const conceptType = slideTypeUpper || (concept.type as 'HOOK' | 'CONTENT' | 'CTA')

        // Skip if slide has no type and AI didn't provide one
        if (!conceptType) continue

        processedSlideIndices.add(slideIdx)

        extractedConcepts.push({
          title: concept.title,
          coreMessage: concept.coreMessage,
          type: conceptType,
          exampleText: slide.text,
          sourcePostId: slide.postId,
          sourceSlideIndex: slide.slideIndex
        })
      }
    }

    // Process any slides that weren't included in AI concepts
    // This ensures ALL slides get analyzed, especially CTA slides
    for (let i = 0; i < slides.length; i++) {
      if (processedSlideIndices.has(i)) continue

      const slide = slides[i]
      const slideTypeUpper = slide.slideType?.toUpperCase() as 'HOOK' | 'CONTENT' | 'CTA' | undefined

      // Only process slides with a known type
      if (!slideTypeUpper) continue

      // Create a generic concept for unprocessed slides
      const typeLabels = {
        'HOOK': 'Attention Grabber',
        'CONTENT': 'Teaching Point',
        'CTA': 'Call to Action'
      }

      extractedConcepts.push({
        title: `${typeLabels[slideTypeUpper]} Pattern`,
        coreMessage: `A ${slideTypeUpper.toLowerCase()} pattern extracted from carousel content`,
        type: slideTypeUpper,
        exampleText: slide.text,
        sourcePostId: slide.postId,
        sourceSlideIndex: slide.slideIndex
      })
    }

    return extractedConcepts
  } catch (error) {
    console.error('AI extraction failed:', error)
    return []
  }
}
