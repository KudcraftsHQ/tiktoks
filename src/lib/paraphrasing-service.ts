/**
 * Paraphrasing Service
 *
 * Service for generating paraphrased content variations using Gemini AI
 */

import { GoogleGenAI } from '@google/genai'
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
    const ocrTexts = originalPost.ocrTexts as Array<{
      imageIndex: number
      text: string
      success: boolean
      error?: string
    }>

    if (!ocrTexts.length) {
      throw new Error('No OCR text data available. Please run OCR processing first.')
    }

    const images = originalPost.images as Array<{
      cacheAssetId: string
      width: number
      height: number
    }>

    // Prepare context for AI
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
    })

    if (!response.text) {
      throw new Error('No response from AI model')
    }

    console.log(`🔍 [Paraphrasing] Raw AI response:`, response.text)

    // Parse the JSON response
    let parsedResponse
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? jsonMatch[0] : response.text
      parsedResponse = JSON.parse(jsonText)
    } catch (parseError) {
      console.error(`❌ [Paraphrasing] Failed to parse JSON response:`, response.text)
      throw new Error('Failed to parse AI response as JSON')
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

export async function createRemixFromParaphrasing(
  originalPostId: string,
  remixContent: RemixContent[],
  remixName: string,
  remixDescription?: string
): Promise<string> {
  try {
    console.log(`🏗️ [Paraphrasing] Creating remix for post: ${originalPostId}`)

    return await prisma.$transaction(async (tx) => {
      // Create the remix post
      const remixPost = await tx.remixPost.create({
        data: {
          originalPostId,
          name: remixName,
          description: remixDescription,
          generationType: 'ai_paraphrase'
        }
      })

      console.log(`✅ [Paraphrasing] Created remix post: ${remixPost.id}`)

      // Create slides for each piece of content
      for (const content of remixContent) {
        const slide = await tx.remixSlide.create({
          data: {
            remixPostId: remixPost.id,
            displayOrder: content.imageIndex,
            // Note: originalImageId will be set when we implement background selection
          }
        })

        // Create a text box with the paraphrased content
        await tx.remixTextBox.create({
          data: {
            slideId: slide.id,
            text: content.paraphrasedText,
            x: 0.1, // Default positioning
            y: 0.3,
            width: 0.8,
            height: 0.4,
            fontSize: 24,
            fontFamily: 'Poppins',
            fontWeight: 'bold',
            color: '#ffffff',
            textAlign: 'center',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)', // Add shadow for readability
          }
        })

        console.log(`✅ [Paraphrasing] Created slide ${content.imageIndex + 1}/${remixContent.length}`)
      }

      return remixPost.id
    })

  } catch (error) {
    console.error(`❌ [Paraphrasing] Failed to create remix:`, error)
    throw error instanceof Error ? error : new Error('Failed to create remix')
  }
}