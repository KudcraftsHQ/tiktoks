/**
 * Paraphrasing Service
 *
 * Service for generating paraphrased content variations using Gemini AI
 */

import { GoogleGenAI, Type } from '@google/genai'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema for structured output from Gemini
const RemixContentSchema = z.object({
  slides: z.array(z.object({
    imageIndex: z.number(),
    paraphrasedText: z.string(),
    imageDescription: z.string(),
    suggestedBackgroundConcept: z.string()
  }))
})

export interface RemixContent {
  imageIndex: number
  paraphrasedText: string
  imageDescription: string
  suggestedBackgroundConcept: string
}

export interface GenerateRemixOptions {
  theme?: string
  style?: 'casual' | 'professional' | 'trendy' | 'educational' | 'humorous'
  targetAudience?: string
}

export async function generateRemixContent(
  originalPost: any, // TikTokPost with relations
  options: GenerateRemixOptions = {}
): Promise<RemixContent[]> {
  try {
    console.log(`🤖 [Paraphrasing] Starting content generation for post: ${originalPost.id}`)

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    if (originalPost.contentType !== 'photo') {
      throw new Error('Post must be a photo carousel for remix generation')
    }

    // Get OCR texts for the post
    let ocrTexts: Array<{
      imageIndex: number
      text: string
      success: boolean
      error?: string
    }>

    // Handle both string and array formats
    if (typeof originalPost.ocrTexts === 'string') {
      try {
        ocrTexts = JSON.parse(originalPost.ocrTexts)
      } catch (error) {
        throw new Error('Invalid OCR text format. Please run OCR processing again.')
      }
    } else {
      ocrTexts = originalPost.ocrTexts || []
    }

    if (!Array.isArray(ocrTexts) || !ocrTexts.length) {
      throw new Error('No OCR text data available. Please run OCR processing first.')
    }

    const images = originalPost.images as Array<{
      cacheAssetId: string
      width: number
      height: number
    }>

    // Prepare context for AI - filter successful OCR results
    const originalTexts = ocrTexts
      .filter(ocr => ocr.success && ocr.text.trim().length > 0)
      .map(ocr => ({
        imageIndex: ocr.imageIndex,
        originalText: ocr.text
      }))

    if (!originalTexts.length) {
      throw new Error('No successful OCR text results found')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    // Build the prompt
    const prompt = buildParaphrasingPrompt(originalPost, originalTexts, options)

    console.log(`📝 [Paraphrasing] Generated prompt for ${originalTexts.length} slides`)

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: prompt }]
      }
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  imageIndex: { type: Type.NUMBER },
                  paraphrasedText: { type: Type.STRING },
                  imageDescription: { type: Type.STRING },
                  suggestedBackgroundConcept: { type: Type.STRING }
                },
                required: ["imageIndex", "paraphrasedText", "imageDescription", "suggestedBackgroundConcept"]
              }
            }
          },
          required: ["slides"]
        }
      }
    })

    if (!response.text) {
      throw new Error('No response from AI model')
    }

    console.log(`🔍 [Paraphrasing] Raw AI response:`, response.text)

    // Parse the structured JSON response (should be pure JSON now)
    let parsedResponse
    try {
      parsedResponse = JSON.parse(response.text)
    } catch (parseError) {
      console.error(`❌ [Paraphrasing] Failed to parse JSON response:`, response.text)
      throw new Error('Failed to parse AI structured response as JSON')
    }

    // Validate the response structure
    const validation = RemixContentSchema.safeParse(parsedResponse)
    if (!validation.success) {
      console.error(`❌ [Paraphrasing] Invalid response structure:`, validation.error)
      throw new Error('AI response does not match expected structure')
    }

    const remixContent = validation.data.slides

    console.log(`✅ [Paraphrasing] Successfully generated ${remixContent.length} remix variations`)

    return remixContent

  } catch (error) {
    console.error(`❌ [Paraphrasing] Failed to generate remix content:`, error)
    throw error instanceof Error ? error : new Error('Paraphrasing failed')
  }
}

function buildParaphrasingPrompt(
  originalPost: any,
  originalTexts: Array<{ imageIndex: number; originalText: string }>,
  options: GenerateRemixOptions
): string {
  const { theme, style = 'casual', targetAudience } = options

  return `
You are an expert content creator specializing in social media remix generation.

Given a TikTok photo carousel post, create paraphrased variations of the text content while maintaining the same message and impact.

ORIGINAL POST CONTEXT:
- Post URL: ${originalPost.tiktokUrl}
- Author: ${originalPost.authorNickname || originalPost.authorHandle || 'Unknown'}
- Description: ${originalPost.description || 'No description'}
- Content Type: Photo Carousel
- Total Images: ${originalPost.images.length}

STYLE REQUIREMENTS:
- Writing Style: ${style}
- Theme: ${theme || 'Keep original theme'}
- Target Audience: ${targetAudience || 'General social media users'}

ORIGINAL TEXT CONTENT:
${originalTexts.map(item => `
Slide ${item.imageIndex + 1}:
"${item.originalText}"
`).join('')}

TASK:
For each slide, create a paraphrased version that:
1. Maintains the core message and intent
2. Uses different wording and structure
3. Matches the specified style (${style})
4. Stays engaging for social media
5. Preserves any key numbers, facts, or calls-to-action

Also provide:
- A brief description of what visual elements would work well
- A suggested background concept that complements the text

IMPORTANT: Respond with ONLY a valid JSON object in this exact format:
{
  "slides": [
    {
      "imageIndex": 0,
      "paraphrasedText": "Your paraphrased version here",
      "imageDescription": "Brief description of visual elements that would work well",
      "suggestedBackgroundConcept": "Concept for background image (e.g., 'minimalist gradient', 'nature scene', 'abstract pattern')"
    }
  ]
}

Generate content for all ${originalTexts.length} slides. Do not include any other text outside the JSON.
`.trim()
}

// Note: This function is deprecated with the new JSON structure
// The API now handles the remix creation directly with the new schema
export async function createRemixFromParaphrasing(
  originalPostId: string,
  remixContent: RemixContent[],
  remixName: string,
  remixDescription?: string
): Promise<string> {
  throw new Error('This function is deprecated. Use the new API structure with JSON slides.')
}