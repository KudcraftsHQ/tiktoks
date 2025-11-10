import { GoogleGenAI, Type } from '@google/genai'
import * as Sentry from '@sentry/nextjs'

// Structured output schema for content generation
const CONTENT_GENERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    variations: {
      type: Type.ARRAY,
      description: "Array of content variations generated",
      items: {
        type: Type.OBJECT,
        properties: {
          variationIndex: {
            type: Type.NUMBER,
            description: "Zero-based index of this variation"
          },
          slides: {
            type: Type.ARRAY,
            description: "Slides for this variation",
            items: {
              type: Type.OBJECT,
              properties: {
                slideIndex: {
                  type: Type.NUMBER,
                  description: "Zero-based index of the slide"
                },
                slideType: {
                  type: Type.STRING,
                  enum: ['hook', 'content', 'cta'],
                  description: "Type of slide: 'hook' (first slide), 'content' (middle slides), or 'cta' (call-to-action, usually second to last)"
                },
                text: {
                  type: Type.STRING,
                  description: "The text content for this slide"
                },
                sourcePostReference: {
                  type: Type.STRING,
                  description: "Optional reference to which source post inspired this slide (e.g., 'Post 1', 'Post 3')"
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Confidence score for this slide (0-1)"
                }
              },
              propertyOrdering: ['slideIndex', 'slideType', 'text', 'sourcePostReference', 'confidence']
            }
          },
          metadata: {
            type: Type.OBJECT,
            description: "Metadata about this variation",
            properties: {
              totalSlides: {
                type: Type.NUMBER,
                description: "Total number of slides in this variation"
              },
              mainTheme: {
                type: Type.STRING,
                description: "The main theme or topic of this variation"
              },
              description: {
                type: Type.STRING,
                description: "A cohesive narrative summary that paraphrases all slides content as one flowing story. This should read like a natural, engaging paragraph that captures the entire carousel journey from hook to conclusion."
              }
            },
            propertyOrdering: ['totalSlides', 'mainTheme', 'description']
          }
        },
        propertyOrdering: ['variationIndex', 'slides', 'metadata']
      }
    },
    generationMetadata: {
      type: Type.OBJECT,
      description: "Overall generation metadata",
      properties: {
        totalVariations: {
          type: Type.NUMBER,
          description: "Total number of variations generated"
        },
        generatedAt: {
          type: Type.STRING,
          description: "ISO timestamp of generation"
        },
        strategy: {
          type: Type.STRING,
          description: "Strategy used: 'remix' or 'inspired'"
        }
      },
      propertyOrdering: ['totalVariations', 'generatedAt', 'strategy']
    }
  },
  propertyOrdering: ['variations', 'generationMetadata']
}

export interface SourcePost {
  id: string
  description?: string | null
  contentType: string
  ocrTexts: Array<{ imageIndex: number; text: string; success: boolean }>
  imageDescriptions: Array<{ imageIndex: number; imageDescription: string; success: boolean }>
  slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }>
  category?: { id: string; name: string } | null
}

export interface GenerationConfig {
  sourcePosts: SourcePost[]
  productContext?: { title: string; description: string }
  generationStrategy: 'remix' | 'inspired'
  languageStyle: string
  contentIdeas?: string
  variationCount: number
  slidesRange: { min: number; max: number }
}

export interface GeneratedSlide {
  slideIndex: number
  slideType: 'hook' | 'content' | 'cta'
  text: string
  sourcePostReference?: string
  confidence: number
}

export interface GeneratedVariation {
  variationIndex: number
  slides: GeneratedSlide[]
  metadata: {
    totalSlides: number
    mainTheme: string
    description: string
  }
}

export interface GenerationResult {
  variations: GeneratedVariation[]
  generationMetadata: {
    totalVariations: number
    generatedAt: string
    strategy: string
  }
}

function buildPrompt(config: GenerationConfig): string {
  const { sourcePosts, productContext, generationStrategy, languageStyle, contentIdeas, variationCount, slidesRange } = config

  // Build source posts context
  const postsContext = sourcePosts.map((post, index) => {
    const postNum = index + 1
    const ocrText = post.ocrTexts
      .filter(t => t.success && t.text)
      .map(t => `Slide ${t.imageIndex + 1}: ${t.text}`)
      .join('\n')

    const descriptions = post.imageDescriptions
      .filter(d => d.success && d.imageDescription)
      .map(d => `Slide ${d.imageIndex + 1}: ${d.imageDescription}`)
      .join('\n')

    return `
**Reference Post ${postNum}** (${post.contentType})
- Category: ${post.category?.name || 'Uncategorized'}
- Description: ${post.description || 'No description'}
- OCR Texts:
${ocrText || 'No text extracted'}
- Visual Descriptions:
${descriptions || 'No descriptions available'}
`
  }).join('\n\n')

  // Product context section
  const productSection = productContext
    ? `\n**Product Context:**
${productContext.title}
${productContext.description}\n`
    : ''

  // Content ideas section
  const contentIdeasSection = contentIdeas
    ? `\n**Additional Content Ideas:**
${contentIdeas}\n`
    : ''

  // Strategy description
  const strategyDescription = generationStrategy === 'remix'
    ? `Your goal is to **remix and paraphrase** the reference posts above. Keep the core structure, themes, and key messages, but rewrite the text in a fresh way while maintaining the essence of the original content.`
    : `Your goal is to **create new content inspired by** the reference posts above. Use them as inspiration for themes, structure, and style, but create completely new content that explores different angles, examples, or perspectives.`

  const prompt = `You are a TikTok carousel content creator. Analyze the reference posts below and generate ${variationCount} variations of carousel content.

${postsContext}
${productSection}
**Language Style:**
${languageStyle}
${contentIdeasSection}

**Generation Strategy:**
${strategyDescription}

**CRITICAL REQUIREMENTS:**

1. EXACT Slide Structure (no exceptions):
   - Exactly ONE HOOK slide (must be the first slide)
   - Exactly ONE CTA slide (preferred to be second-to-last slide, but can also be last slide)${productContext ? ', and ONLY mention the product here' : ''}
   - All other slides must be CONTENT slides (not hooks or CTAs)
   - The last slide (if not CTA) should be a satisfying conclusion

2. Content Flow:
   - HOOK: Create curiosity and establish the topic
   - CONTENT slides: Build knowledge progressively, each slide flowing naturally from the previous (like telling a story)
   - CTA: CRITICAL - This is NOT a sales pitch. Continue the storyteller's POV naturally. Example: "This is exactly what I built into [product]..." or "That's why I created [product] - to help you..." The CTA should feel like the storyteller sharing their solution, not selling. ${productContext ? 'Weave in the product context as part of the storyteller\'s personal journey.' : 'If no product context, make it a call to action related to the story (e.g., "try this yourself", "start today", etc.)'}
   - Optional final slide: If CTA is second-to-last, add a satisfying conclusion/summary as the last slide that wraps up the storyteller's journey
   - The sequence must feel conversational, not jumpy or disconnected

3. Slide Count:
   - Generate exactly ${variationCount} variations
   - Each variation should have between ${slidesRange.min} and ${slidesRange.max} slides
   - Maintain the hook → content → cta structure regardless of total slides

4. Language & Style:
   - Follow the specified language style
   - Ensure each slide builds upon the previous one
   - Use transitions that guide the viewer logically through the content
   - Make each variation unique and valuable
   - The CTA must feel like the storyteller's personal revelation or solution, written in first-person POV

5. CTA Examples (Soft-Selling, Story-Driven):
   ✅ GOOD: "This is exactly what I built into [Product] - a tool that analyzes your content before you post"
   ✅ GOOD: "That's why I created [Product]. It's helped me stay consistent without burning out"
   ✅ GOOD: "I automated this whole process in [Product] so you don't have to do it manually"
   ✅ GOOD: "After months of testing, I built [Product] to make this easier for creators like us"
   ❌ BAD: "Get [Product] now! Limited time offer!" (too salesy)
   ❌ BAD: "Check out [Product] for all these features!" (feature dump)
   ❌ BAD: "Click the link to buy [Product]" (direct sales pitch)

6. Variation Metadata:
   - For each variation, create a cohesive "description" field that paraphrases ALL slides as one flowing narrative
   - This description should read like a natural, engaging story that captures the entire carousel journey
   - It should flow smoothly from the hook through the content to the conclusion
   - Keep the same tone and style as the carousel content
   - This is NOT a meta-description about the carousel - it IS the story told by the carousel in paragraph form

Return the structured JSON response following the schema.`

  return prompt
}

export async function generateContent(config: GenerationConfig): Promise<GenerationResult> {
  try {
    console.log(`🚀 [ContentGen] Starting content generation with ${config.variationCount} variations`)

    // Initialize Gemini AI
    if (!process.env.GEMINI_API_KEY) {
      const error = new Error('GEMINI_API_KEY environment variable is required')
      Sentry.captureException(error, {
        tags: { operation: 'content_generation' }
      })
      throw error
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    // Build the prompt
    const prompt = buildPrompt(config)

    console.log(`🤖 [ContentGen] Calling Gemini with structured output...`)

    // Call Gemini with structured output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: CONTENT_GENERATION_SCHEMA,
      },
    })

    if (!response.text) {
      const error = new Error('No response from Gemini AI')
      Sentry.captureException(error, {
        tags: { operation: 'content_generation' },
        extra: { response }
      })
      throw error
    }

    console.log(`✅ [ContentGen] Received structured response from Gemini`)

    // Parse the structured response
    const generationResult: GenerationResult = JSON.parse(response.text)

    console.log(`📊 [ContentGen] Generated:`, {
      totalVariations: generationResult.generationMetadata.totalVariations,
      strategy: generationResult.generationMetadata.strategy,
      variationsCount: generationResult.variations.length
    })

    return generationResult

  } catch (error) {
    console.error(`❌ [ContentGen] Failed to generate content:`, error)

    // Report to Sentry
    Sentry.captureException(error, {
      tags: { operation: 'content_generation' },
      extra: { config }
    })

    throw error instanceof Error ? error : new Error('Content generation failed')
  }
}
