import { GoogleGenAI, Type } from '@google/genai'
import { cacheAssetService } from './cache-asset-service'
import { PrismaClient } from '@/generated/prisma'
import * as Sentry from '@sentry/nextjs'

const prisma = new PrismaClient()

// Response schema for structured OCR output
const OCR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    postCategory: {
      type: Type.OBJECT,
      description: "Overall category classification for the entire post",
      properties: {
        category: {
          type: Type.STRING,
          description: "The category name. Use existing category if it fits, or create a new one if confident it's needed."
        },
        confidence: {
          type: Type.NUMBER,
          description: "Confidence score for the category classification (0-1)"
        },
        isNewCategory: {
          type: Type.BOOLEAN,
          description: "Set to true if this is a new category not in the existing list, false if using an existing category"
        },
      },
      propertyOrdering: ['category', 'confidence', 'isNewCategory'],
    },
    slides: {
      type: Type.ARRAY,
      description: "Analysis of each individual slide in the carousel",
      items: {
        type: Type.OBJECT,
        properties: {
          imageIndex: {
            type: Type.NUMBER,
            description: "Zero-based index of the slide in the carousel"
          },
          slideType: {
            type: Type.STRING,
            enum: ['hook', 'content', 'cta'],
            description: "MUST be one of: 'hook' (first slide should always be hook), 'content' (middle slides), or 'cta' (usually last or second-last slide, the slide that contains product mention, cta or even soft selling)"
          },
          ocrText: {
            type: Type.STRING,
            description: "Extract ONLY the overlay text that the user added on top of the image (like text captions/titles in TikTok carousels). DO NOT extract text that is embedded in the background image or part of the original photo. If multiple text overlays exist, separate them with \\n. Return empty string if no overlay text is present."
          },
          imageDescription: {
            type: Type.STRING,
            description: "Detailed visual description of the slide including colors, layout, objects, style, mood, and composition. Be specific and comprehensive."
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence score for this slide's classification (0-1)"
          },
        },
        propertyOrdering: ['imageIndex', 'slideType', 'ocrText', 'imageDescription', 'confidence'],
      },
    },
    processingMetadata: {
      type: Type.OBJECT,
      description: "Metadata about the processing operation",
      properties: {
        totalSlides: {
          type: Type.NUMBER,
          description: "Total number of slides processed"
        },
        processedAt: {
          type: Type.STRING,
          description: "ISO timestamp of when processing completed"
        },
        allSlidesProcessed: {
          type: Type.BOOLEAN,
          description: "Whether all slides were successfully processed"
        },
      },
      propertyOrdering: ['totalSlides', 'processedAt', 'allSlidesProcessed'],
    },
  },
  propertyOrdering: ['postCategory', 'slides', 'processingMetadata'],
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString('base64')
}

async function fetchImageFromCacheAsset(cacheAssetId: string): Promise<string> {
  console.log(`🔍 [OCR] Fetching image from cache asset: ${cacheAssetId}`)

  // Get the presigned URL or fallback URL from cache asset service
  const imageUrl = await cacheAssetService.getUrl(cacheAssetId)

  if (!imageUrl) {
    throw new Error(`No URL available for cache asset: ${cacheAssetId}`)
  }

  console.log(`📥 [OCR] Fetching image from URL: ${imageUrl}`)
  return fetchImageAsBase64(imageUrl)
}

export async function performOCRForTikTokPost(postId: string): Promise<void> {
  try {
    console.log(`🚀 [OCR] Starting batch OCR processing for TikTokPost: ${postId}`)

    // Get the TikTokPost with its images
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId }
    })

    if (!post) {
      const error = new Error(`TikTokPost not found: ${postId}`)
      Sentry.captureException(error, {
        tags: { operation: 'ocr', postId }
      })
      throw error
    }

    if (post.contentType !== 'photo') {
      const error = new Error(`TikTokPost ${postId} is not a photo carousel`)
      Sentry.captureException(error, {
        tags: { operation: 'ocr', postId, contentType: post.contentType }
      })
      throw error
    }

    // Update status to processing
    await prisma.tiktokPost.update({
      where: { id: postId },
      data: {
        ocrStatus: 'processing',
        updatedAt: new Date()
      }
    })

    // Parse the JSON string properly
    const images = typeof post.images === 'string'
      ? JSON.parse(post.images) as Array<{ cacheAssetId: string; width: number; height: number }>
      : post.images as Array<{ cacheAssetId: string; width: number; height: number }>

    if (!Array.isArray(images) || !images.length) {
      const error = new Error(`No valid images array found in TikTokPost: ${postId}`)
      Sentry.captureException(error, {
        tags: { operation: 'ocr', postId },
        extra: { images: post.images }
      })
      throw error
    }

    console.log(`📝 [OCR] Processing ${images.length} images in batch for post: ${postId}`)

    // Fetch all existing categories to pass to AI
    const existingCategories = await prisma.postCategory.findMany({
      select: { name: true }
    })
    const categoryList = existingCategories.map(c => c.name).join(', ')

    // Load all images in parallel
    console.log(`📥 [OCR] Loading ${images.length} images...`)
    const imageDataPromises = images.map(async (image, index) => {
      console.log(`🔍 [OCR] Loading image ${index + 1}/${images.length}: ${image.cacheAssetId}`)
      const base64 = await fetchImageFromCacheAsset(image.cacheAssetId)
      return { index, base64 }
    })

    const imageDataResults = await Promise.all(imageDataPromises)
    console.log(`✅ [OCR] All images loaded successfully`)

    // Initialize Gemini AI
    if (!process.env.GEMINI_API_KEY) {
      const error = new Error('GEMINI_API_KEY environment variable is required')
      Sentry.captureException(error, {
        tags: { operation: 'ocr', postId }
      })
      throw error
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    // Build the prompt parts with all images
    const promptParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = []

    // Add all images
    imageDataResults.forEach((imageData) => {
      promptParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData.base64,
        },
      })
    })

    // Add the instruction text
    const instruction = `You are analyzing a TikTok photo carousel with ${images.length} slides.

EXISTING POST CATEGORIES IN DATABASE:
${categoryList || 'None yet - you can create new categories'}

Analyze the carousel and provide:
1. Post-level category classification
2. Detailed analysis for each of the ${images.length} slides

Follow the schema definitions for all fields. Return the structured JSON response.`

    promptParts.push({ text: instruction })

    console.log(`🤖 [OCR] Calling Gemini with batch structured output...`)

    // Call Gemini with structured output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: promptParts,
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: OCR_RESPONSE_SCHEMA,
      },
    })

    if (!response.text) {
      const error = new Error('No response from Gemini AI')
      Sentry.captureException(error, {
        tags: { operation: 'ocr', postId },
        extra: { response }
      })
      throw error
    }

    console.log(`✅ [OCR] Received structured response from Gemini`)

    // Parse the structured response
    const ocrData = JSON.parse(response.text)
    console.log(JSON.stringify(ocrData, null, 2));

    console.log(`📊 [OCR] Parsed response:`, {
      category: ocrData.postCategory.category,
      isNewCategory: ocrData.postCategory.isNewCategory,
      slidesProcessed: ocrData.slides.length
    })

    // Handle category - create if new
    let postCategoryId: string | null = null

    if (ocrData.postCategory.isNewCategory) {
      console.log(`🆕 [OCR] Creating new category: ${ocrData.postCategory.category}`)
      const newCategory = await prisma.postCategory.create({
        data: {
          name: ocrData.postCategory.category,
          aiGenerated: true,
          postCount: 1
        }
      })
      postCategoryId = newCategory.id
    } else {
      // Find existing category
      const existingCategory = await prisma.postCategory.findFirst({
        where: { name: ocrData.postCategory.category }
      })

      if (existingCategory) {
        postCategoryId = existingCategory.id
        // Increment count
        await prisma.postCategory.update({
          where: { id: existingCategory.id },
          data: { postCount: { increment: 1 } }
        })
      } else {
        console.warn(`⚠️ [OCR] Category not found, creating: ${ocrData.postCategory.category}`)
        const newCategory = await prisma.postCategory.create({
          data: {
            name: ocrData.postCategory.category,
            aiGenerated: true,
            postCount: 1
          }
        })
        postCategoryId = newCategory.id
      }
    }

    // Denormalize for easy querying
    const ocrTexts = ocrData.slides.map((slide: any) => ({
      imageIndex: slide.imageIndex,
      text: slide.ocrText,
      success: true
    }))

    const imageDescriptions = ocrData.slides.map((slide: any) => ({
      imageIndex: slide.imageIndex,
      imageDescription: slide.imageDescription,
      success: true
    }))

    const slideClassifications = ocrData.slides.map((slide: any) => ({
      slideIndex: slide.imageIndex,
      slideType: slide.slideType,
      confidence: slide.confidence
    }))

    // Update the post with all results
    await prisma.tiktokPost.update({
      where: { id: postId },
      data: {
        // Store full structured response
        ocrData: ocrData,

        // Denormalized fields for easy querying
        ocrTexts: JSON.stringify(ocrTexts),
        imageDescriptions: JSON.stringify(imageDescriptions),
        slideClassifications: JSON.stringify(slideClassifications),

        // Category
        postCategoryId,
        categoryConfidence: ocrData.postCategory.confidence,

        // Status
        ocrStatus: 'completed',
        ocrProcessedAt: new Date(),
        classificationStatus: 'completed',
        classificationProcessedAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`🎉 [OCR] Batch processing completed for TikTokPost ${postId}:`, {
      category: ocrData.postCategory.category,
      slidesProcessed: ocrData.slides.length,
      allSlidesProcessed: ocrData.processingMetadata.allSlidesProcessed
    })

  } catch (error) {
    console.error(`❌ [OCR] Failed to process TikTokPost ${postId}:`, error)

    // Report to Sentry
    Sentry.captureException(error, {
      tags: { operation: 'ocr', postId },
      extra: { postId }
    })

    // Update status to failed
    await prisma.tiktokPost.update({
      where: { id: postId },
      data: {
        ocrStatus: 'failed',
        updatedAt: new Date()
      }
    })

    throw error instanceof Error ? error : new Error('OCR processing failed')
  }
}

export async function performBatchOCRForTikTokPosts(postIds: string[]): Promise<Array<{ postId: string; success: boolean; error?: string }>> {
  console.log(`🚀 [OCR] Starting batch OCR for ${postIds.length} TikTokPosts`)

  const results = await Promise.allSettled(
    postIds.map(async (postId) => {
      try {
        await performOCRForTikTokPost(postId)
        return { postId, success: true }
      } catch (error) {
        console.error(`❌ [OCR] Batch processing failed for ${postId}:`, error)
        return {
          postId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  )

  const finalResults = results.map(result =>
    result.status === 'fulfilled' ? result.value : {
      postId: 'unknown',
      success: false,
      error: result.reason?.message || 'Batch OCR failed'
    }
  )

  const successCount = finalResults.filter(r => r.success).length
  console.log(`🎉 [OCR] Batch processing completed: ${successCount}/${postIds.length} posts processed successfully`)

  return finalResults
}