/**
 * Minimal Paraphrase Service
 *
 * Lightweight service for paraphrasing single text examples with configurable intensity.
 * Distinct from full post remix paraphrasing (paraphrasing-service.ts).
 */

import { GoogleGenAI } from '@google/genai'

export type ParaphraseIntensity = 'minimal' | 'medium' | 'high'

interface ParaphraseConfig {
  temperature: number
  instruction: string
  lengthVariance: string
}

// Configuration for each intensity level
const INTENSITY_CONFIGS: Record<ParaphraseIntensity, ParaphraseConfig> = {
  minimal: {
    temperature: 0.7,
    instruction: 'Make small word substitutions. Keep sentence structure identical. Use synonyms where appropriate but maintain the exact flow.',
    lengthVariance: 'within 20%'
  },
  medium: {
    temperature: 0.9,
    instruction: 'Rewrite with different wording and sentence structure. Keep same message and impact. You can reorganize sentences.',
    lengthVariance: 'within 30%'
  },
  high: {
    temperature: 1.1,
    instruction: 'Creative rewrite with fresh approach. Maintain core insight and slide type requirements but feel free to use completely different angles.',
    lengthVariance: 'within 30%'
  }
}

// Slide-type-specific rules
const SLIDE_TYPE_RULES = {
  HOOK: `
- Create intrigue and information gap
- Use lowercase "i" (never "I")
- Drop apostrophes: "heres" not "here's", "ive" not "I've", "dont" not "don't"
- End with setup for what's coming: "heres what...", "this is what..."
- Keep it conversational and casual
`,
  CONTENT: `
- Bold statement + Why it matters + Personal reaction
- Use lowercase "i" (never "I")
- Drop apostrophes: "heres" not "here's", "ive" not "I've", "dont" not "don't"
- Use insider language and authenticity markers: "honestly", "literally", "ngl", "i swear"
- Casual grammar, incomplete sentences OK
`,
  CTA: `
- 50-70 words, 4-part rhythm structure
- Use lowercase "i" (never "I")
- Drop apostrophes: "heres" not "here's", "ive" not "I've", "dont" not "don't"
- Authenticity markers: "honestly", "literally", "ngl", "i swear"
- Personal, direct tone
`
}

/**
 * Paraphrase a single text example with configurable intensity
 *
 * @param text - Original text to paraphrase
 * @param slideType - Type of slide (HOOK/CONTENT/CTA) for type-specific rules
 * @param intensity - Paraphrase intensity level (minimal/medium/high)
 * @returns Paraphrased text
 */
export async function paraphraseSingleExample(
  text: string,
  slideType: 'HOOK' | 'CONTENT' | 'CTA',
  intensity: ParaphraseIntensity = 'minimal'
): Promise<string> {
  try {
    console.log(`🔄 [MinimalParaphrase] Starting paraphrase: intensity=${intensity}, slideType=${slideType}`)

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const config = INTENSITY_CONFIGS[intensity]
    const slideRules = SLIDE_TYPE_RULES[slideType]

    const prompt = buildParaphrasePrompt(text, slideType, slideRules, config)

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
        temperature: config.temperature,
        maxOutputTokens: 500
      }
    })

    if (!response.text) {
      throw new Error('No response from AI model')
    }

    const paraphrasedText = response.text.trim()

    console.log(`✅ [MinimalParaphrase] Successfully paraphrased (${text.length} → ${paraphrasedText.length} chars)`)

    return paraphrasedText

  } catch (error) {
    console.error(`❌ [MinimalParaphrase] Failed to paraphrase:`, error)
    // Fallback to original text on error
    console.warn(`⚠️ [MinimalParaphrase] Falling back to original text`)
    return text
  }
}

function buildParaphrasePrompt(
  text: string,
  slideType: string,
  slideRules: string,
  config: ParaphraseConfig
): string {
  return `You are a TikTok carousel content expert. Paraphrase the following ${slideType} slide text while maintaining its core message and impact.

ORIGINAL TEXT:
"${text}"

PARAPHRASE INTENSITY:
${config.instruction}

SLIDE TYPE REQUIREMENTS (${slideType}):
${slideRules}

LENGTH REQUIREMENT:
Keep length similar to original (${config.lengthVariance} variance acceptable).

CRITICAL RULES:
- Maintain the core message and intent
- Apply all slide type requirements listed above
- Use casual, conversational tone throughout
- Do NOT add emojis unless the original has them
- Do NOT add hashtags
- Keep the authentic, real-person voice

Respond with ONLY the paraphrased text. No explanation, no metadata, no quotes around it.`.trim()
}
