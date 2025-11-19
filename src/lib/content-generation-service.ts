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

  // Hook examples for the model to learn from
  const hookExamplesSection = `
**HOOK SLIDE FORMULA (CRITICAL - Study These Patterns):**

Reference examples from successful viral content:
   - "My harvard marketing professor did a lecture about the tiktok algorithm, heres what ive learned..."
   - "The wildest things I've learned about the algorithm during my internship at tiktok..."
   - "I've been posting consistently for 5 months, heres what ive learned..."
   - "I've been watching my bf grow his account to 800k, and heres what ive learned..."

Pattern breakdown:
   1. [Authority/Credibility Source] → establishes trust (Harvard prof, TikTok internship, 800k account)
   2. [Tease the topic] → creates curiosity (don't reveal the actual insight)
   3. "heres what ive learned..." → promises value WITHOUT revealing it

CRITICAL HOOK RULES:
   ❌ DO NOT reveal the actual insight in the hook (save it for slide 2+)
   ❌ DO NOT use dramatic language ("truth bomb", "mind blown", "changed EVERYTHING", "totally")
   ❌ DO NOT be overly polished - use casual, lowercase, imperfect grammar ("heres" not "here's", "ive" not "I've")
   ❌ DO NOT add unnecessary hype words or all caps for emphasis
   ✅ DO create an information gap that can ONLY be closed by swiping to the next slide
   ✅ DO establish credibility/authority naturally (professor, internship, successful friend, personal experience)
   ✅ DO keep it conversational - like texting a friend, not writing marketing copy
   ✅ DO end with the "heres what ive learned" pattern or similar casual promise

The hook should feel like a friend about to share a secret, not a marketer making a pitch.
`

  // CTA examples for the model to learn from
  const ctaExamplesSection = productContext
    ? `
**CTA SLIDE EXAMPLES (Study These Patterns):**

Example 1 (55-60 words):
"one of the biggest changes? i stopped guessing and started actually analyzing.

i use this app called ${productContext.title}. it not only predicts my vids performance, it tells me exactly what to fix: pacing, hook, captions... it's like getting coached by the algorithm itself"

Example 2 (50-55 words):
"some apps can really do the heavy lifting for you.

used to be like 'why did this flop?' now i check my videos in ${productContext.title} before i post. it's like a lil algorithm bff that gives notes while i do my skincare 🫶"

Example 3 (45-50 words):
"easy to overthink your own content endlessly.

started using ${productContext.title} recently to analyze my videos before posting. gives you an outside perspective on what needs work. pretty helpful honestly"

Example 4 (50-55 words):
"they pay close attention to what works.

tools like ${productContext.title} help with that. they show what's holding people, what's not, and how to improve without the guesswork"

**CRITICAL CTA PATTERNS:**
1. LENGTH: 45-60 words minimum (current examples are too short!)
2. TWO-PART STRUCTURE:
   - Part 1: Relatable problem/realization (1-2 sentences)
   - Part 2: Casual tool discovery woven into daily life (2-3 sentences)
3. AUTHENTIC MARKERS: "honestly", "lol", "ngl", "pretty helpful", "i swear"
4. LIFESTYLE INTEGRATION: Reference daily activities ("while i do my skincare", "before i post", "sipping iced coffee")
5. SPECIFIC BENEFITS: Mention 2-3 concrete features without sounding like a sales pitch
6. CONVERSATIONAL TONE: Use lowercase, natural pauses, incomplete thoughts
7. PERSONAL EXPERIENCE: "i use", "i found", "started using", NOT "you should try"
`
    : ''

  const prompt = `You are a TikTok carousel content creator. Analyze the reference posts below and generate ${variationCount} variations of carousel content.

${postsContext}
${productSection}
**Language Style:**
${languageStyle}
${contentIdeasSection}

**Generation Strategy:**
${strategyDescription}
${hookExamplesSection}
${ctaExamplesSection}

**CRITICAL REQUIREMENTS:**

1. EXACT Slide Structure (no exceptions):
   - Exactly ONE HOOK slide (must be the first slide)
   - Exactly ONE CTA slide (MUST be second-to-last slide)${productContext ? '. This slide should feel like a natural recommendation from a friend, NOT a sales pitch. Lead with the transformation/benefit, then mention the product almost casually as your personal discovery. Use phrases like "I found...", "honestly...", "I swear...", or "ngl" to maintain authenticity' : ''}
   - All other slides must be CONTENT slides (not hooks or CTAs)
   - The last slide MUST be a satisfying conclusion that wraps up after the CTA

2. Open Loop Psychology - CRITICAL FOR VIRALITY:
   - Each slide MUST create an open loop (information gap) that hooks the viewer to swipe to the next slide
   - Viewers must feel compelled to close this info gap by swiping
   - Every slide should act as a mini-hook for the next slide, creating continuous engagement
   - Use techniques like: incomplete thoughts, teasing next information, raising questions, building curiosity
   - This open loop pattern repeats throughout the entire carousel to maximize retention

3. Viral Slideshow Formats (categorise this one on the response):
   - **Listicles**: Numbered items that build anticipation (e.g., "3 mistakes...", "5 secrets...")
   - **Day in the Life**: Personal journey narrative that reveals insights progressively
   - **This vs That**: Comparative analysis that contrasts two approaches/options
   - **Problem-Solution Storyline**: Present a relatable problem, then build toward the solution
   - **Question Hook + Answer Slides**: Open with a provocative question, reveal answers slide by slide
   - **Subtle Product Showcase**: Demonstrate product value through storytelling, not direct selling
   - **Educational**: Teach something valuable step-by-step, keeping viewers engaged to complete learning

4. Content Flow:
   - HOOK: Follow the HOOK SLIDE FORMULA above exactly. Establish authority/credibility, tease the topic, end with "heres what ive learned" pattern. DO NOT reveal the insight - create an open loop that MUST be closed by swiping.
   - CONTENT slides: Build knowledge progressively, each slide flowing naturally from the previous (like telling a story). EACH slide must create a new open loop while closing the previous one. Maintain the casual, authentic voice from the hook.
   - Soft CTA (SECOND-TO-LAST SLIDE): ${productContext ? 'This should read like a genuine personal recommendation, NOT marketing copy. Lead with the transformation/benefit that solves pain points from earlier slides, then casually introduce the product as your personal discovery. Use first-person experience markers ("I found", "I use", "honestly", "I swear") and maintain the same conversational tone as the rest of the carousel. Study the reference posts\' CTA style - notice how they sound like secrets being shared, not products being sold.' : 'Study the reference posts\' CTA style and adapt it naturally without altering the core approach. It should flowing naturally from the previous slide.'}
   - FINAL SLIDE (LAST SLIDE): Add a satisfying conclusion/summary that wraps up the storyteller's journey and provides closure after the CTA
   - The sequence must feel conversational, not jumpy or disconnected
   - Open loops should create a natural pull to the next slide, not feel forced${productContext ? '\n\n**CRITICAL: CTA Slide Guidelines (Second-to-Last Slide):**\n   - LENGTH REQUIREMENT: 45-60 words MINIMUM (this is crucial - short CTAs underperform!)\n   - TWO-PART STRUCTURE:\n     • Part 1 (15-20 words): Start with a relatable realization or problem ("one of the biggest changes?", "easy to overthink your content", "used to be like \'why did this flop?\'")\n     • Part 2 (30-40 words): Casual tool introduction with specific benefits\n   - Frame it as YOUR personal discovery, not a recommendation ("i use this app called...", "started using...", "i found...")\n   - LIFESTYLE INTEGRATION: Weave into daily routine ("while i do my skincare", "before i post", "sipping my coffee")\n   - SPECIFIC FEATURES: Mention 2-3 concrete benefits ("predicts performance", "tells me what to fix", "shows hook strength") WITHOUT sounding like marketing\n   - AUTHENTIC MARKERS: Include natural reactions ("honestly", "ngl", "pretty helpful honestly", "it\'s like...", "i swear")\n   - CONVERSATIONAL TONE: Use lowercase, natural pauses, incomplete thoughts, casual rhythm\n   - The benefit should directly address pain points built up in CONTENT slides\n   - Make it feel like sharing a secret with a friend, NOT selling a product' : ''}

3. Slide Count:
   - Generate exactly ${variationCount} variations
   - Each variation should have between ${slidesRange.min} and ${slidesRange.max} slides
   - Maintain the hook → content → cta structure regardless of total slides

5. Language & Style - AUTHENTICITY IS CRITICAL:
   - Follow the specified language style, but prioritize authenticity over perfection
   - Write like you're texting a friend, NOT writing an essay or marketing copy
   - Use casual, lowercase grammar naturally: "heres" not "here's", "ive" not "I've", "dont" not "don't"
   - AVOID dramatic marketing language: NO "truth bomb", "mind blown", "changed EVERYTHING", "totally", "absolutely"
   - AVOID all caps for emphasis unless it's natural/conversational
   - Keep it conversational and imperfect - this builds trust and feels authentic
   - Study the reference posts' casual tone and replicate it exactly across ALL slides
   - Each slide should sound like it came from the same real person, not a copywriter
   - Ensure each slide builds upon the previous one with natural transitions
   - Make each variation unique and valuable

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
