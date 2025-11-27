import { GoogleGenAI, Type } from '@google/genai'
import { cacheAssetService } from './cache-asset-service'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// Simple schema for face detection
const FACE_DETECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hasFace: {
      type: Type.BOOLEAN,
      description: "Whether the image contains a visible human face (true if any face is visible, false otherwise)"
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence score for the face detection (0-1)"
    }
  },
  propertyOrdering: ['hasFace', 'confidence'],
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
  const imageUrl = await cacheAssetService.getUrl(cacheAssetId)

  if (!imageUrl) {
    throw new Error(`No URL available for cache asset: ${cacheAssetId}`)
  }

  return fetchImageAsBase64(imageUrl)
}

export interface FaceDetectionResult {
  hasFace: boolean
  confidence: number
}

/**
 * Detect if an image contains a human face using Gemini Vision
 */
export async function detectFace(cacheAssetId: string): Promise<FaceDetectionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required')
  }

  const base64Image = await fetchImageFromCacheAsset(cacheAssetId)

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{
      role: 'user' as const,
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: 'Does this image contain a visible human face? Analyze the image and determine if there is at least one human face visible. Return hasFace as true if any face is clearly visible, false otherwise.',
        },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: FACE_DETECTION_SCHEMA,
    },
  })

  if (!response.text) {
    throw new Error('No response from Gemini AI')
  }

  // Parse the response
  let cleanedText = response.text.trim()
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const result = JSON.parse(cleanedText) as FaceDetectionResult

  return {
    hasFace: result.hasFace,
    confidence: result.confidence
  }
}

/**
 * Detect face in an asset and update the database record
 */
export async function detectFaceForAsset(assetId: string): Promise<{ hasFace: boolean; faceAnalyzedAt: Date }> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId }
  })

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  const result = await detectFace(asset.cacheAssetId)

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: {
      hasFace: result.hasFace,
      faceAnalyzedAt: new Date()
    }
  })

  return {
    hasFace: updated.hasFace!,
    faceAnalyzedAt: updated.faceAnalyzedAt!
  }
}

/**
 * Batch detect faces for multiple assets
 * Processes in parallel batches to avoid rate limits
 */
export async function detectFacesForAssets(
  assetIds: string[],
  batchSize: number = 5
): Promise<Map<string, { hasFace: boolean; faceAnalyzedAt: Date }>> {
  const results = new Map<string, { hasFace: boolean; faceAnalyzedAt: Date }>()

  // Process in batches
  for (let i = 0; i < assetIds.length; i += batchSize) {
    const batch = assetIds.slice(i, i + batchSize)

    const batchPromises = batch.map(async (assetId) => {
      try {
        const result = await detectFaceForAsset(assetId)
        results.set(assetId, result)
      } catch (error) {
        console.error(`Failed to detect face for asset ${assetId}:`, error)
        // Don't throw - continue with other assets
      }
    })

    await Promise.all(batchPromises)
  }

  return results
}
