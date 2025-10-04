import { GoogleGenAI } from '@google/genai'
import { cacheAssetService } from './cache-asset-service'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

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

export async function performOCR(imageUrl: string): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
    
    const imageBase64 = await fetchImageAsBase64(imageUrl)
    
    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: 'Extract all text from this image. Return only the text content, no additional commentary or formatting.',
          },
        ],
      },
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
    })
    
    if (!response.text) {
      throw new Error('No text extracted from image')
    }
    
    return response.text.trim()
  } catch (error) {
    console.error('OCR processing failed:', error)
    throw error instanceof Error ? error : new Error('OCR processing failed')
  }
}

export async function performBatchOCR(imageUrls: string[]): Promise<Array<{ imageUrl: string; text: string; success: boolean; error?: string }>> {
  const results = await Promise.allSettled(
    imageUrls.map(async (imageUrl) => {
      try {
        const text = await performOCR(imageUrl)
        return { imageUrl, text, success: true }
      } catch (error) {
        console.error(`OCR failed for ${imageUrl}:`, error)
        return { 
          imageUrl, 
          text: '', 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    })
  )

  return results.map(result =>
    result.status === 'fulfilled' ? result.value : {
      imageUrl: result.reason.imageUrl || 'unknown',
      text: '',
      success: false,
      error: result.reason.message || 'OCR failed'
    }
  )
}

export async function performOCRFromCacheAsset(cacheAssetId: string): Promise<string> {
  try {
    console.log(`🔍 [OCR] Starting OCR for cache asset: ${cacheAssetId}`)

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    const imageBase64 = await fetchImageFromCacheAsset(cacheAssetId)

    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: 'Extract all text from this image. Return only the text content, no additional commentary or formatting.',
          },
        ],
      },
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
    })

    if (!response.text) {
      throw new Error('No text extracted from image')
    }

    console.log(`✅ [OCR] Successfully extracted text from cache asset: ${cacheAssetId}`)
    return response.text.trim()
  } catch (error) {
    console.error(`❌ [OCR] Failed for cache asset ${cacheAssetId}:`, error)
    throw error instanceof Error ? error : new Error('OCR processing failed')
  }
}

export async function generateImageDescription(cacheAssetId: string): Promise<string> {
  try {
    console.log(`🎨 [Image Description] Starting analysis for cache asset: ${cacheAssetId}`)

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    const imageBase64 = await fetchImageFromCacheAsset(cacheAssetId)

    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: `Analyze this image and provide a detailed visual description that can be used as a search prompt or image generation prompt.

Include:
- Main subject/objects and their characteristics
- Colors, lighting, and mood
- Composition and layout style
- Any notable visual elements or patterns
- Setting or environment
- Overall aesthetic or style

Be specific and descriptive. This description will be used to search for or generate similar images.

Return ONLY the description, no additional commentary.`,
          },
        ],
      },
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
    })

    if (!response.text) {
      throw new Error('No description generated from image')
    }

    console.log(`✅ [Image Description] Successfully generated description for cache asset: ${cacheAssetId}`)
    return response.text.trim()
  } catch (error) {
    console.error(`❌ [Image Description] Failed for cache asset ${cacheAssetId}:`, error)
    throw error instanceof Error ? error : new Error('Image description generation failed')
  }
}

export async function performOCRForTikTokPost(postId: string): Promise<void> {
  try {
    console.log(`🚀 [OCR] Starting OCR processing for TikTokPost: ${postId}`)

    // Get the TikTokPost with its images
    const post = await prisma.tiktokPost.findUnique({
      where: { id: postId }
    })

    if (!post) {
      throw new Error(`TikTokPost not found: ${postId}`)
    }

    console.log(`📋 [OCR] Found TikTokPost:`, {
      id: post.id,
      contentType: post.contentType,
      imagesData: post.images,
      imagesType: typeof post.images,
      imagesLength: Array.isArray(post.images) ? post.images.length : 'not an array'
    })

    if (post.contentType !== 'photo') {
      throw new Error(`TikTokPost ${postId} is not a photo carousel`)
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

    console.log(`🔍 [OCR] Parsed images array:`, images)
    console.log(`🔍 [OCR] First image details:`, images[0])

    if (!Array.isArray(images) || !images.length) {
      throw new Error(`No valid images array found in TikTokPost: ${postId}`)
    }

    console.log(`📝 [OCR] Processing ${images.length} images for post: ${postId}`)

    // Log each cacheAssetId
    images.forEach((image, index) => {
      console.log(`🏷️ [OCR] Image ${index + 1} cacheAssetId: ${image.cacheAssetId} (type: ${typeof image.cacheAssetId})`)
    })

    const ocrResults: Array<{ imageIndex: number; text: string; success: boolean; error?: string }> = []
    const imageDescriptionResults: Array<{ imageIndex: number; imageDescription: string; success: boolean; error?: string }> = []

    // Process each image for both OCR and image description
    for (let i = 0; i < images.length; i++) {
      const image = images[i]

      try {
        console.log(`🔍 [OCR] Processing image ${i + 1}/${images.length}: ${image.cacheAssetId}`)

        // Extract text via OCR
        const text = await performOCRFromCacheAsset(image.cacheAssetId)

        ocrResults.push({
          imageIndex: i,
          text,
          success: true
        })

        console.log(`✅ [OCR] Successfully extracted text from image ${i + 1}/${images.length}`)

      } catch (error) {
        console.error(`❌ [OCR] Failed to extract text from image ${i + 1}:`, error)

        ocrResults.push({
          imageIndex: i,
          text: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Generate detailed image description
      try {
        console.log(`🎨 [Image Description] Processing image ${i + 1}/${images.length}: ${image.cacheAssetId}`)

        const imageDescription = await generateImageDescription(image.cacheAssetId)

        imageDescriptionResults.push({
          imageIndex: i,
          imageDescription,
          success: true
        })

        console.log(`✅ [Image Description] Successfully generated description for image ${i + 1}/${images.length}`)

      } catch (error) {
        console.error(`❌ [Image Description] Failed to generate description for image ${i + 1}:`, error)

        imageDescriptionResults.push({
          imageIndex: i,
          imageDescription: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Update the post with OCR results and image descriptions
    await prisma.tiktokPost.update({
      where: { id: postId },
      data: {
        ocrTexts: JSON.stringify(ocrResults),
        imageDescriptions: JSON.stringify(imageDescriptionResults),
        ocrStatus: 'completed',
        ocrProcessedAt: new Date(),
        updatedAt: new Date()
      }
    })

    const ocrSuccessCount = ocrResults.filter(r => r.success).length
    const descriptionSuccessCount = imageDescriptionResults.filter(r => r.success).length
    console.log(`🎉 [OCR] Completed processing for TikTokPost ${postId}: ${ocrSuccessCount}/${images.length} texts extracted, ${descriptionSuccessCount}/${images.length} descriptions generated`)

  } catch (error) {
    console.error(`❌ [OCR] Failed to process TikTokPost ${postId}:`, error)

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