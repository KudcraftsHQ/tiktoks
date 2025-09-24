import { GoogleGenAI } from '@google/genai'

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString('base64')
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