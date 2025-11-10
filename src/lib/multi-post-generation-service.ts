import { GoogleGenAI } from '@google/genai'
import { PrismaClient } from '@/generated/prisma'
import { CANVAS_SIZES, createDefaultBackgroundLayers } from './validations/remix-schema'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const prisma = new PrismaClient()

export interface GenerationConfig {
  name: string
  variationCount: number
  structure: {
    type: 'fixed' | 'dynamic'
    fixedPattern?: string // e.g., "1 hook + 5 content + 1 cta"
    minSlides?: number
    maxSlides?: number
  }
  additionalPrompt?: string
  productContextId?: string
}

export interface GeneratedRemix {
  id: string
  name: string
  slides: any[]
}

interface PostData {
  id: string
  description?: string
  ocrTexts: any
  images: any[]
  authorNickname?: string
  authorHandle?: string
}

/**
 * Generate multiple remix variations from multiple source posts
 */
export async function generateFromMultiplePosts(
  sourcePostIds: string[],
  config: GenerationConfig
): Promise<GeneratedRemix[]> {
  try {
    console.log(`🎨 Generating ${config.variationCount} variations from ${sourcePostIds.length} source posts`)

    // Fetch source posts with OCR data
    const sourcePosts = await prisma.tiktokPost.findMany({
      where: {
        id: { in: sourcePostIds },
        ocrStatus: 'completed'
      },
      include: {
        profile: true
      }
    })

    if (sourcePosts.length === 0) {
      throw new Error('No posts with completed OCR found')
    }

    // Get product context if provided
    let productContext = null
    if (config.productContextId) {
      productContext = await prisma.productContext.findUnique({
        where: { id: config.productContextId }
      })
    }

    // Analyze posts to learn patterns
    const analysisResult = await analyzePostPatterns(sourcePosts)

    // Generate variations
    const generatedRemixes: GeneratedRemix[] = []

    for (let i = 0; i < config.variationCount; i++) {
      console.log(`  📝 Generating variation ${i + 1}/${config.variationCount}...`)

      const remix = await generateSingleVariation(
        sourcePosts,
        config,
        analysisResult,
        productContext,
        i
      )

      generatedRemixes.push(remix)
    }

    console.log(`✅ Successfully generated ${generatedRemixes.length} variations`)
    return generatedRemixes
  } catch (error) {
    console.error('Failed to generate from multiple posts:', error)
    throw new Error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Analyze multiple posts to learn patterns
 */
async function analyzePostPatterns(posts: any[]) {
  try {
    // Prepare posts data for analysis
    const postsData = posts.map(post => {
      const ocrTexts = typeof post.ocrTexts === 'string'
        ? JSON.parse(post.ocrTexts)
        : post.ocrTexts || []

      return {
        id: post.id,
        description: post.description,
        slideCount: Array.isArray(post.images) ? post.images.length : 0,
        slides: ocrTexts.map((ocr: any) => ({
          text: ocr.text,
          position: ocr.imageIndex
        }))
      }
    })

    const prompt = `You are an expert at analyzing TikTok carousel content patterns.

ANALYZE THESE SUCCESSFUL POSTS:
${JSON.stringify(postsData, null, 2)}

IDENTIFY:
1. Common structural patterns (slide counts, hook/content/CTA distribution)
2. Language style patterns (tone, sentence length, emoji usage, punctuation)
3. Content themes and categories
4. Hook strategies
5. CTA approaches
6. Common phrases and writing patterns

RESPOND WITH VALID JSON ONLY (no markdown):
{
  "structuralPatterns": {
    "avgSlideCount": 6,
    "slideCountRange": { "min": 5, "max": 8 },
    "commonPattern": "1 hook + 4-6 content + 1 cta"
  },
  "languageStyle": {
    "tone": "casual-professional",
    "avgSentenceLength": 12,
    "emojiUsage": "moderate",
    "commonPhrases": ["here's the truth", "game changer"],
    "punctuationStyle": "exclamatory",
    "writingPatterns": "Short punchy sentences with personal voice"
  },
  "contentThemes": ["lessons learned", "tips and tricks", "mistakes to avoid"],
  "hookStrategies": ["bold claims", "personal stories", "shocking stats"],
  "ctaApproaches": ["feature highlight", "problem solution"],
  "styleProfile": "Educational content with authentic personal experience, using casual but authoritative tone"
}`

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: prompt }]
      }
    ]

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    })

    return JSON.parse(result.text)
  } catch (error) {
    console.error('Pattern analysis failed:', error)
    throw error
  }
}

/**
 * Generate a single variation
 */
async function generateSingleVariation(
  sourcePosts: any[],
  config: GenerationConfig,
  analysis: any,
  productContext: any,
  variationIndex: number
): Promise<GeneratedRemix> {
  try {
    // Determine slide count
    let slideCount: number
    if (config.structure.type === 'fixed') {
      // Parse fixed pattern like "1 hook + 5 content + 1 cta"
      const match = config.structure.fixedPattern?.match(/\d+/g)
      slideCount = match ? match.reduce((sum, num) => sum + parseInt(num), 0) : 6
    } else {
      // Dynamic: use analysis or config min/max
      const min = config.structure.minSlides || analysis.structuralPatterns.slideCountRange.min
      const max = config.structure.maxSlides || analysis.structuralPatterns.slideCountRange.max
      slideCount = Math.floor(Math.random() * (max - min + 1)) + min
    }

    // Prepare source content for reference
    const sourceContent = sourcePosts.map(post => {
      const ocrTexts = typeof post.ocrTexts === 'string'
        ? JSON.parse(post.ocrTexts)
        : post.ocrTexts || []

      return {
        slides: ocrTexts.map((ocr: any) => ocr.text).filter(Boolean)
      }
    })

    const prompt = `You are an expert content creator specializing in viral TikTok carousels.

SOURCE POSTS FOR REFERENCE (learn the style, don't copy):
${JSON.stringify(sourceContent, null, 2)}

LEARNED STYLE PROFILE:
${JSON.stringify(analysis.languageStyle, null, 2)}

${productContext ? `PRODUCT CONTEXT:
${productContext.description}
` : ''}

${config.additionalPrompt ? `ADDITIONAL INSTRUCTIONS:
${config.additionalPrompt}
` : ''}

CREATE A NEW ${slideCount}-SLIDE CAROUSEL:

CRITICAL STRUCTURE REQUIREMENTS:
1. Exactly ONE HOOK slide (must be the first slide)
2. Exactly ONE CTA slide (must be the last slide)${productContext ? ' - mention the product ONLY here' : ''}
3. All middle slides must be CONTENT slides

CONTENT FLOW REQUIREMENTS:
4. Create a natural conversation that builds progressively - each slide should flow into the next
5. H slide: Create curiosity with the main topic
6. CONTENT slides: Build knowledge step-by-step, each slide expanding on the previous
7. CTA slide: Compelling call-to-action${productContext ? ' that naturally incorporates the product' : ''}

STYLE REQUIREMENTS:
8. Match the learned language style exactly (tone, sentence length, emoji usage, punctuation)
9. Use similar writing patterns but with completely unique content
10. Make each slide engaging and swipeable
11. Variation ${variationIndex + 1} should be unique from other variations

RESPOND WITH VALID JSON ONLY (no markdown):
{
  "slides": [
    {
      "text": "Slide text here",
      "type": "HOOK" | "CONTENT" | "CTA",
      "suggestedCategory": "Category name"
    }
  ],
  "languageStyleTags": ["casual", "emoji-moderate", "short-punchy"]
}`

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: prompt }]
      }
    ]

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
      config: {
        temperature: 0.8, // Higher temperature for more variation
        responseMimeType: 'application/json'
      }
    })

    const generated = JSON.parse(result.text)

    // Transform to remix slide structure
    const slides = generated.slides.map((slide: any, index: number) => ({
      id: `slide_${Date.now()}_${variationIndex}_${index}`,
      displayOrder: index,
      canvas: CANVAS_SIZES.INSTAGRAM_STORY,
      backgroundLayers: createDefaultBackgroundLayers(),
      paraphrasedText: slide.text,
      originalText: '',
      textBoxes: []
    }))

    // Generate a compelling description based on the actual content
    const firstHookSlide = generated.slides.find(s => s.type === 'HOOK')?.text || ''
    const contentThemes = generated.slides.filter(s => s.type === 'CONTENT').slice(0, 2).map(s => {
      // Extract theme from first 30 chars of content slide
      const theme = s.text.substring(0, 30).replace(/[.!?]+$/, '')
      return theme
    })
    
    // Create natural-sounding description
    let description: string
    if (contentThemes.length > 0) {
      description = `${firstHookSlide.substring(0, 50).replace(/[.!?]+$/, '')} → ${contentThemes.join(' → ')} that transforms the way you...` // Truncate for brevity
    } else {
      description = `An engaging carousel about ${firstHookSlide.substring(0, 40).replace(/[.!?]+$/, '')}⁠… that delivers real value` // Truncate for brevity
    }
    
    // Clean up and ensure proper length
    description = description.replace(/[.!?]+$/, '')
    if (description.length > 150) {
      description = description.substring(0, 147) + '...'
    }

    // Create the remix post in database
    const remixPost = await prisma.remixPost.create({
      data: {
        sourcePostIds: sourcePosts.map(p => p.id),
        productContextId: config.productContextId || null,
        name: `${config.name} - Variation ${variationIndex + 1}`,
        description: description,
        generationType: 'ai_multi_post',
        generationPrompt: prompt,
        languageStyleTags: generated.languageStyleTags || [],
        isDraft: true,
        slides: JSON.stringify(slides)
      }
    })

    // Note: Classification for remix posts can be added later if needed
    // For now, just return the generated remix without classification

    return {
      id: remixPost.id,
      name: remixPost.name,
      slides
    }
  } catch (error) {
    console.error('Failed to generate variation:', error)
    throw error
  }
}

/**
 * Get all draft remixes
 */
export async function getDraftRemixes(
  page: number = 1,
  limit: number = 25,
  filters?: {
    generationType?: string
    searchQuery?: string
  }
) {
  const skip = (page - 1) * limit

  const where: any = {
    isDraft: true
  }

  if (filters?.generationType) {
    where.generationType = filters.generationType
  }

  if (filters?.searchQuery) {
    where.OR = [
      { name: { contains: filters.searchQuery, mode: 'insensitive' } },
      { description: { contains: filters.searchQuery, mode: 'insensitive' } }
    ]
  }

  const [remixes, total] = await Promise.all([
    prisma.remixPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            generationStrategy: true,
            languageStyle: true,
            createdAt: true
          }
        }
      }
    }),
    prisma.remixPost.count({ where })
  ])

  return {
    remixes: remixes.map(remix => ({
      ...remix,
      slides: typeof remix.slides === 'string' ? JSON.parse(remix.slides) : remix.slides,
      slideClassifications: typeof remix.slideClassifications === 'string'
        ? JSON.parse(remix.slideClassifications)
        : remix.slideClassifications
    })),
    total,
    page,
    limit,
    hasMore: skip + remixes.length < total
  }
}
