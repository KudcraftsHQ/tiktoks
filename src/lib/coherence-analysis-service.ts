/**
 * Coherence Analysis Service
 *
 * AI-powered analysis of POV/voice inconsistencies in carousel slides.
 * Only analyzes CONTENT slides against HOOK and CTA reference slides.
 */

import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'

export interface CoherenceIssue {
  type: 'pov_inconsistency' | 'voice_mismatch' | 'tone_jump' | 'product_mismatch'
  slideIndices: number[]
  description: string
  severity: 'high' | 'medium' | 'low'
  currentValue?: string
  suggestedValue?: string
}

export interface CoherenceAnalysis {
  issues: CoherenceIssue[]
  affectedSlideCount: number
  recommendation: string
}

interface SlideWithIndex {
  slide: { paraphrasedText: string }
  index: number
}

interface SlideClassification {
  slideIndex: number
  type: string
}

// Zod schema for AI response validation
const CoherenceAnalysisSchema = z.object({
  issues: z.array(z.object({
    type: z.enum(['pov_inconsistency', 'voice_mismatch', 'tone_jump', 'product_mismatch']),
    slideIndices: z.array(z.number()),
    description: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    currentValue: z.string().optional(),
    suggestedValue: z.string().optional()
  })),
  affectedSlideCount: z.number(),
  recommendation: z.string()
})

/**
 * Analyze carousel slides for POV/voice/tone coherence issues
 * Also checks CTA slides for correct product mentions
 *
 * @param slides - All slides in the carousel
 * @param classifications - Slide type classifications
 * @param productContext - Optional product context for CTA validation
 * @returns Coherence analysis with issues found
 */
export async function analyzeCoherence(
  slides: Array<{ paraphrasedText: string }>,
  classifications: SlideClassification[],
  productContext?: { title: string; description: string } | null
): Promise<CoherenceAnalysis> {
  try {
    console.log(`🔍 [CoherenceAnalysis] Analyzing ${slides.length} slides`)

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

    // If no content slides, nothing to check
    if (contentSlides.length === 0) {
      console.log(`ℹ️ [CoherenceAnalysis] No CONTENT slides to analyze`)
      return {
        issues: [],
        affectedSlideCount: 0,
        recommendation: 'No content slides to analyze.'
      }
    }

    const prompt = buildAnalysisPrompt(contentSlides, hookSlide, ctaSlide)

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

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
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  slideIndices: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER }
                  },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING }
                },
                required: ["type", "slideIndices", "description", "severity"]
              }
            },
            affectedSlideCount: { type: Type.NUMBER },
            recommendation: { type: Type.STRING }
          },
          required: ["issues", "affectedSlideCount", "recommendation"]
        },
        temperature: 0.9 // Higher temp for better pattern recognition
      }
    })

    if (!response.text) {
      throw new Error('No response from AI model')
    }

    // Parse and validate response
    const parsed = JSON.parse(response.text)
    const validation = CoherenceAnalysisSchema.safeParse(parsed)

    if (!validation.success) {
      console.error(`❌ [CoherenceAnalysis] Invalid response structure:`, validation.error)
      throw new Error('AI response does not match expected structure')
    }

    const analysis = validation.data

    // Add product context validation for CTA slides if product context is provided
    if (productContext) {
      const productIssues = analyzeCTAProductContext(slides, classifications, productContext)
      analysis.issues.push(...productIssues)
      if (productIssues.length > 0) {
        // Update affected slide count
        const allAffectedIndices = new Set<number>()
        analysis.issues.forEach(issue => {
          issue.slideIndices.forEach(idx => allAffectedIndices.add(idx))
        })
        analysis.affectedSlideCount = allAffectedIndices.size
      }
    }

    console.log(`✅ [CoherenceAnalysis] Found ${analysis.issues.length} issues affecting ${analysis.affectedSlideCount} slides`)

    return analysis

  } catch (error) {
    console.error(`❌ [CoherenceAnalysis] Failed to analyze:`, error)
    throw error instanceof Error ? error : new Error('Analysis failed')
  }
}

function buildAnalysisPrompt(
  contentSlides: SlideWithIndex[],
  hookSlide: { paraphrasedText: string } | undefined,
  ctaSlide: { paraphrasedText: string } | undefined
): string {
  return `You are a TikTok carousel content expert. Analyze for OBVIOUS POV/voice inconsistencies in CONTENT slides.

REFERENCE SLIDES (These define the target POV/voice - do NOT modify):
${hookSlide ? `HOOK: "${hookSlide.paraphrasedText}"` : 'No HOOK slide'}
${ctaSlide ? `CTA: "${ctaSlide.paraphrasedText}"` : 'No CTA slide'}

CONTENT SLIDES TO CHECK:
${contentSlides.map(({ slide, index }) =>
  `Slide ${index + 1}: "${slide.paraphrasedText}"`
).join('\n')}

Find CLEAR issues only. Examples of OBVIOUS problems:
1. **POV Inconsistency**: HOOK uses "i copied a creator" (observer POV) but CONTENT says "i have experienced slow weeks" (participant POV)
2. **Voice Mismatch**: HOOK uses casual grammar (lowercase "i", dropped apostrophes) but CONTENT uses formal grammar
3. **Tone Jumps**: HOOK is excited and energetic but CONTENT is serious and detached

CRITICAL:
- Only flag OBVIOUS issues that would make readers notice the inconsistency
- If the carousel is reasonably coherent, return empty issues array
- Don't flag subtle differences or stylistic choices
- Focus on clear breaks in POV, voice, or tone

Respond with JSON only:
{
  "issues": [
    {
      "type": "pov_inconsistency" | "voice_mismatch" | "tone_jump",
      "slideIndices": [array of affected slide numbers],
      "description": "specific issue description",
      "severity": "high" | "medium" | "low"
    }
  ],
  "affectedSlideCount": number of slides with issues,
  "recommendation": "brief summary of what needs fixing"
}`.trim()
}

/**
 * Analyze CTA slides for product context mismatches
 *
 * @param slides - All slides in the carousel
 * @param classifications - Slide type classifications
 * @param productContext - Product context to validate against
 * @returns Array of product mismatch issues
 */
function analyzeCTAProductContext(
  slides: Array<{ paraphrasedText: string }>,
  classifications: SlideClassification[],
  productContext: { title: string; description: string }
): CoherenceIssue[] {
  const issues: CoherenceIssue[] = []

  // Find CTA slides
  const ctaSlides = classifications
    .filter(c => c.type === 'CTA')
    .map(c => ({ index: c.slideIndex, slide: slides[c.slideIndex] }))

  for (const { index, slide } of ctaSlides) {
    if (!slide) continue

    const text = slide.paraphrasedText
    const textLower = text.toLowerCase()

    // Check if CTA mentions a product
    const productMentionPatterns = [
      /there'?s?\s+this\s+(?:app|tool|website|platform)\s+called\s+([^.!?\n]+)/i,
      /(?:app|tool|website|platform)\s+called\s+([^.!?\n]+)/i,
      /check\s+out\s+([^.!?\n]+)/i,
      /try\s+(?:using\s+)?([^.!?\n]+)/i,
      /i\s+use\s+([^.!?\n]+)/i,
      /called\s+([^.!?\n]+)\s+that/i
    ]

    let mentionedProduct: string | null = null
    for (const pattern of productMentionPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        mentionedProduct = match[1].trim()
        // Remove trailing punctuation and common words
        mentionedProduct = mentionedProduct.replace(/[,;:.]$/, '').trim()
        break
      }
    }

    // Validate against expected product
    if (mentionedProduct) {
      const expectedProduct = productContext.title.toLowerCase()
      const actualProduct = mentionedProduct.toLowerCase()

      if (actualProduct !== expectedProduct) {
        issues.push({
          type: 'product_mismatch',
          slideIndices: [index],
          description: `CTA mentions "${mentionedProduct}" but project uses "${productContext.title}"`,
          severity: 'high',
          currentValue: mentionedProduct,
          suggestedValue: productContext.title
        })
      }
    } else {
      // CTA should mention the product if product context exists
      issues.push({
        type: 'product_mismatch',
        slideIndices: [index],
        description: `CTA slide should mention product "${productContext.title}"`,
        severity: 'medium',
        suggestedValue: productContext.title
      })
    }
  }

  return issues
}
