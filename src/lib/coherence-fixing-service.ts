/**
 * Coherence Fixing Service
 *
 * AI-powered fixing of POV/voice inconsistencies in carousel slides.
 * Only fixes CONTENT slides using HOOK and CTA as reference points.
 */

import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'

export interface FixedSlide {
  slideIndex: number
  fixedText: string
  changes: string
}

export interface CoherenceFixResult {
  slides: FixedSlide[]
  summary: string
}

interface SlideWithIndex {
  slide: { paraphrasedText: string }
  index: number
}

interface SlideClassification {
  slideIndex: number
  type: string
}

// Schema for individual slide fix
const SlideFixSchema = z.object({
  fixedText: z.string(),
  changes: z.string()
})

/**
 * Fix coherence issues in CONTENT slides
 * Uses HOOK and CTA as reference points for desired POV/voice
 *
 * @param slides - All slides in the carousel
 * @param classifications - Slide type classifications
 * @returns Fixed slides with changes summary
 */
export async function fixCoherence(
  slides: Array<{ paraphrasedText: string }>,
  classifications: SlideClassification[]
): Promise<CoherenceFixResult> {
  try {
    console.log(`🔧 [CoherenceFix] Fixing coherence for ${slides.length} slides`)

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    // Helper to get slide type
    const getSlideType = (index: number) =>
      Array.isArray(classifications)
        ? classifications.find(c => c.slideIndex === index)?.type
        : undefined

    // Separate slides by type
    const contentSlides = slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ index }) => getSlideType(index) === 'CONTENT')

    const hookSlide = slides.find((_, i) => getSlideType(i) === 'HOOK')
    const ctaSlide = slides.find((_, i) => getSlideType(i) === 'CTA')

    // If no content slides, nothing to fix
    if (contentSlides.length === 0) {
      console.log(`ℹ️ [CoherenceFix] No CONTENT slides to fix`)
      return {
        slides: [],
        summary: 'No content slides to fix.'
      }
    }

    // Get the content slide indices for deterministic mapping
    const contentSlideIndices = contentSlides.map(cs => cs.index)

    const prompt = buildFixPrompt(contentSlides, hookSlide, ctaSlide)

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    // Build dynamic schema properties for each content slide index
    const slideProperties: Record<string, any> = {}
    for (const idx of contentSlideIndices) {
      slideProperties[`slide_${idx}`] = {
        type: Type.OBJECT,
        properties: {
          fixedText: { type: Type.STRING },
          changes: { type: Type.STRING }
        },
        required: ["fixedText", "changes"]
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ...slideProperties,
            summary: { type: Type.STRING }
          },
          required: [...contentSlideIndices.map(idx => `slide_${idx}`), "summary"]
        },
        temperature: 0.8 // Balanced between consistency and creativity
      }
    })

    if (!response.text) {
      throw new Error('No response from AI model')
    }

    // Parse response
    const parsed = JSON.parse(response.text)

    // Convert object-based response to array format
    const fixedSlides: FixedSlide[] = []
    for (const idx of contentSlideIndices) {
      const key = `slide_${idx}`
      if (parsed[key]) {
        const slideData = SlideFixSchema.safeParse(parsed[key])
        if (slideData.success) {
          fixedSlides.push({
            slideIndex: idx,
            fixedText: slideData.data.fixedText,
            changes: slideData.data.changes
          })
        } else {
          console.warn(`[CoherenceFix] Invalid data for ${key}:`, slideData.error)
        }
      }
    }

    const result: CoherenceFixResult = {
      slides: fixedSlides,
      summary: parsed.summary || 'Coherence fixes applied.'
    }

    console.log(`✅ [CoherenceFix] Fixed ${result.slides.length} slides`)

    return result

  } catch (error) {
    console.error(`❌ [CoherenceFix] Failed to fix:`, error)
    throw error instanceof Error ? error : new Error('Fixing failed')
  }
}

function buildFixPrompt(
  contentSlides: SlideWithIndex[],
  hookSlide: { paraphrasedText: string } | undefined,
  ctaSlide: { paraphrasedText: string } | undefined
): string {
  return `You are a TikTok carousel content editor. Make MINIMAL changes to fix POV/voice/tone inconsistencies.

REFERENCE SLIDES (match the POV and voice style of these):
${hookSlide ? `HOOK: "${hookSlide.paraphrasedText}"` : 'No HOOK slide'}
${ctaSlide ? `CTA: "${ctaSlide.paraphrasedText}"` : 'No CTA slide'}

CONTENT SLIDES TO FIX:
${contentSlides.map(({ slide, index }) =>
  `slide_${index}: "${slide.paraphrasedText}"`
).join('\n')}

ONLY FIX THESE SPECIFIC ISSUES:
1. **POV shifts**: If HOOK uses "i copied a creator" (observer), fix any CONTENT that says "i have experienced" (participant) to match the observer POV
2. **Capitalization of "i"**: Make lowercase "i" consistent with HOOK/CTA style
3. **Apostrophe style**: Match HOOK/CTA style (if they use "dont", use "dont"; if they use "don't", use "don't")

DO NOT:
- Add slang (do NOT change "people" to "ppl", "for real" to "fr", etc.)
- Add filler words or authenticity markers unless they exist in HOOK/CTA
- Rewrite sentences - only make targeted fixes
- Change words that are already fine
- Make the text "more casual" - only match the existing style

PRESERVE:
- The original sentence structure and flow
- All the original words except those that need POV/voice fixes
- Emojis exactly as they are
- The natural reading rhythm

Respond with JSON:
{
${contentSlides.map(({ index }) => `  "slide_${index}": { "fixedText": "minimally edited version", "changes": "specific changes made" }`).join(',\n')},
  "summary": "brief summary"
}`.trim()
}
