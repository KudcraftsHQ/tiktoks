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

export interface ProductContext {
  title: string
  description: string
}

/**
 * Paraphrase a single text example with configurable intensity
 *
 * @param text - Original text to paraphrase
 * @param slideType - Type of slide (HOOK/CONTENT/CTA) for type-specific rules
 * @param intensity - Paraphrase intensity level (minimal/medium/high)
 * @param productContext - Optional product context for CTA slides
 * @returns Paraphrased text
 */
export async function paraphraseSingleExample(
  text: string,
  slideType: 'HOOK' | 'CONTENT' | 'CTA',
  intensity: ParaphraseIntensity = 'minimal',
  productContext?: ProductContext
): Promise<string> {
  try {
    console.log(`🔄 [MinimalParaphrase] Starting paraphrase: intensity=${intensity}, slideType=${slideType}`)
    if (productContext) {
      console.log(`🏷️ [MinimalParaphrase] Using product context: ${productContext.title}`)
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const config = INTENSITY_CONFIGS[intensity]
    const slideRules = SLIDE_TYPE_RULES[slideType]

    const prompt = buildParaphrasePrompt(text, slideType, slideRules, config, productContext)

    if (productContext) {
      console.log(`📝 [MinimalParaphrase] Prompt includes product replacement for: ${productContext.title}`)
    }

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
  config: ParaphraseConfig,
  productContext?: ProductContext
): string {
  let prompt = `You are a TikTok carousel content expert. Paraphrase the following ${slideType} slide text while maintaining its core message and impact.

ORIGINAL TEXT:
"${text}"`

  // Add product context section for CTA slides
  if (slideType === 'CTA' && productContext) {
    prompt += `

PRODUCT CONTEXT - CRITICAL FOR CTA:
Product Name: ${productContext.title}
Product Description: ${productContext.description}

MANDATORY PRODUCT REPLACEMENT RULES - THIS IS YOUR PRIMARY TASK:
1. IDENTIFY: Find ANY product, brand, tool, service, or app name mentioned in the original text
2. REPLACE: Substitute ALL such names with "${productContext.title}" (keep exact capitalization)
3. CONTEXT: Make sure the paraphrased text naturally promotes "${productContext.title}"
4. CONSISTENCY: Every mention of a product name must become "${productContext.title}"
5. NATURAL: The result should read as if originally written for "${productContext.title}"

Common patterns to replace:
- Direct mentions: "Go Viral" → "${productContext.title}"
- With verbs: "try Skillshare" → "try ${productContext.title}"
- With verbs: "get Canva Pro" → "get ${productContext.title}"
- With verbs: "check out Notion" → "check out ${productContext.title}"
- With verbs: "grab ChatGPT" → "grab ${productContext.title}"
- Possessive: "Skillshare's courses" → "${productContext.title}'s courses"
- Generic: "this tool" → "${productContext.title}"
- Generic: "the product" → "${productContext.title}"
- Generic: "this app" → "${productContext.title}"

IMPORTANT: Look for capitalized words that are product/tool names (like "Go Viral", "Canva", "Notion") and replace them!

EXAMPLE - If original says:
"check out this tool called Go Viral
it shows your estimated likes, hook rating, even whats hurting your views"

And the product to promote is "ContentIQ", output could be:
"heres a tool you need to try called ContentIQ
it gives you estimated likes, hook scores, and shows whats killing your views"

Notice how:
1. "Go Viral" → "ContentIQ" (product replacement)
2. "check out this tool" → "heres a tool you need to try" (paraphrased)
3. "shows your" → "gives you" (paraphrased)
4. "hook rating" → "hook scores" (paraphrased)
5. "whats hurting" → "whats killing" (paraphrased)

CRITICAL: For CTA slides with product context, you must do TWO things:
1. FIRST: Replace the product name with "${productContext.title}"
2. SECOND: Apply minimal paraphrasing to the rest of the text (small word changes, slightly different phrasing)
The result should feel fresh but maintain the same persuasive structure and flow.`
  }

  prompt += `

PARAPHRASE INTENSITY:
${slideType === 'CTA' && productContext
  ? 'MINIMAL - Replace the product name AND paraphrase the rest minimally. Change some words and phrases while keeping the same structure and message.'
  : config.instruction}

SLIDE TYPE REQUIREMENTS (${slideType}):
${slideRules}

LENGTH REQUIREMENT:
${slideType === 'CTA' && productContext
  ? 'Keep similar length to the original (within 20% variance). Replace the product name AND paraphrase the text.'
  : `Keep length similar to original (${config.lengthVariance} variance acceptable).`}

CRITICAL RULES:
- Maintain the core message and intent
- Apply all slide type requirements listed above
- Use casual, conversational tone throughout
- Do NOT add emojis unless the original has them
- Do NOT add hashtags
- Keep the authentic, real-person voice

Respond with ONLY the paraphrased text. No explanation, no metadata, no quotes around it.`

  return prompt.trim()
}
