import { GoogleGenAI, Type } from '@google/genai'
import { PrismaClient, ConceptCategory, ConceptSource, ConceptFreshness } from '@/generated/prisma'
import * as Sentry from '@sentry/nextjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Response schema for structured concept extraction
const CONCEPT_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    concepts: {
      type: Type.ARRAY,
      description: "Array of unique insights/concepts extracted from the posts",
      items: {
        type: Type.OBJECT,
        properties: {
          concept: {
            type: Type.STRING,
            description: "Short, catchy name for the insight (e.g., 'Draft Timestamp Penalty', 'Engagement Mirror Effect')"
          },
          insiderTerm: {
            type: Type.STRING,
            description: "Internal jargon or coined term (e.g., 'draft decay', 'circle pairing', 'identity score')"
          },
          explanation: {
            type: Type.STRING,
            description: "Clear explanation of how this works (e.g., 'System timestamps drafts at creation, not posting')"
          },
          consequence: {
            type: Type.STRING,
            description: "The result/impact of this insight (e.g., 'Older drafts seen as outdated content')"
          },
          viralAngle: {
            type: Type.STRING,
            description: "How this would be phrased in a viral slide (e.g., 'videos left in your drafts lose power')"
          },
          proofPhrase: {
            type: Type.STRING,
            description: "Authentic reaction phrase to use (e.g., 'this one shocked me', 'girl when i found out')"
          },
          credibilitySource: {
            type: Type.STRING,
            description: "How to frame the source (e.g., 'we tracked this internally', 'behind the scenes data')"
          },
          category: {
            type: Type.STRING,
            enum: ['ALGORITHM_MECHANICS', 'ENGAGEMENT', 'CONTENT_STRATEGY', 'MISTAKES', 'MINDSET', 'HIDDEN_FEATURES'],
            description: "Category of the insight"
          }
        },
        propertyOrdering: ['concept', 'insiderTerm', 'explanation', 'consequence', 'viralAngle', 'proofPhrase', 'credibilitySource', 'category']
      }
    },
    extractionMetadata: {
      type: Type.OBJECT,
      description: "Metadata about the extraction",
      properties: {
        totalConcepts: {
          type: Type.NUMBER,
          description: "Total number of concepts extracted"
        },
        categoryCounts: {
          type: Type.OBJECT,
          description: "Count of concepts per category",
          properties: {
            ALGORITHM_MECHANICS: { type: Type.NUMBER },
            ENGAGEMENT: { type: Type.NUMBER },
            CONTENT_STRATEGY: { type: Type.NUMBER },
            MISTAKES: { type: Type.NUMBER },
            MINDSET: { type: Type.NUMBER },
            HIDDEN_FEATURES: { type: Type.NUMBER }
          }
        }
      },
      propertyOrdering: ['totalConcepts', 'categoryCounts']
    }
  },
  propertyOrdering: ['concepts', 'extractionMetadata']
}

export interface ExtractedConcept {
  concept: string
  insiderTerm?: string
  explanation: string
  consequence?: string
  viralAngle?: string
  proofPhrase?: string
  credibilitySource?: string
  category: ConceptCategory
}

export interface ExtractionResult {
  concepts: ExtractedConcept[]
  extractionMetadata: {
    totalConcepts: number
    categoryCounts: Record<string, number>
  }
}

function generateConceptHash(concept: string, explanation: string): string {
  // Create a hash from concept name + explanation for deduplication
  const normalized = `${concept.toLowerCase().trim()}|${explanation.toLowerCase().trim()}`
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32)
}

interface PostData {
  id: string
  description?: string | null
  ocrTexts?: unknown // Can be JsonValue from Prisma, string, or array
  slideClassifications?: unknown // Can be JsonValue from Prisma, string, or array
}

export async function extractConceptsFromPosts(
  posts: PostData[],
  source: ConceptSource = 'EXTRACTED'
): Promise<{ created: number; duplicates: number; concepts: ExtractedConcept[] }> {
  try {
    console.log(`[ConceptExtractor] Starting concept extraction from ${posts.length} posts`)

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    // Build context from posts
    const postsContext = posts.map((post, index) => {
      // Parse ocrTexts - handle string, array, or JsonValue
      let ocrTexts: Array<{ imageIndex: number; text: string }> = []
      if (typeof post.ocrTexts === 'string') {
        ocrTexts = JSON.parse(post.ocrTexts)
      } else if (Array.isArray(post.ocrTexts)) {
        ocrTexts = post.ocrTexts as Array<{ imageIndex: number; text: string }>
      }

      // Parse slideClassifications - handle string, array, or JsonValue
      let slideClassifications: Array<{ slideIndex: number; slideType: string }> = []
      if (typeof post.slideClassifications === 'string') {
        slideClassifications = JSON.parse(post.slideClassifications)
      } else if (Array.isArray(post.slideClassifications)) {
        slideClassifications = post.slideClassifications as Array<{ slideIndex: number; slideType: string }>
      }

      const ocrText = ocrTexts
        .map((t) => `Slide ${t.imageIndex + 1}: ${t.text}`)
        .join('\n')

      const classifications = slideClassifications
        .map((c) => `Slide ${c.slideIndex + 1}: ${c.slideType}`)
        .join(', ')

      return `
**Post ${index + 1}**
- Description: ${post.description || 'No description'}
- Slide Types: ${classifications || 'Unknown'}
- Content Text:
${ocrText || 'No text extracted'}
`
    }).join('\n\n---\n\n')

    const prompt = `You are an expert at analyzing viral TikTok carousel content about social media growth and algorithms.

Analyze the following TikTok posts and extract UNIQUE insights/concepts that creators share about:
- How the TikTok algorithm works
- Engagement strategies
- Content creation tips
- Common mistakes creators make
- Mindset and psychology
- Hidden features and tools

For each insight, extract:
1. **concept**: A catchy, memorable name (like "Draft Timestamp Penalty" or "Engagement Mirror Effect")
2. **insiderTerm**: The internal jargon/coined term creators use (like "draft decay", "identity score")
3. **explanation**: How this actually works
4. **consequence**: What happens as a result
5. **viralAngle**: How to phrase this in a viral slide (casual, lowercase, imperfect grammar)
6. **proofPhrase**: Authentic reaction phrase ("this one shocked me", "girl when i found out")
7. **credibilitySource**: How to frame authority ("we tracked this internally", "behind the scenes")
8. **category**: Classification of the insight

IMPORTANT:
- Extract DISTINCT concepts - don't repeat similar insights
- Focus on actionable, specific insights (not generic advice like "be consistent")
- Capture the "insider knowledge" feel - these should sound like leaked secrets
- Use casual language for viralAngle (lowercase "i", dropped apostrophes like "heres", "ive")

POSTS TO ANALYZE:
${postsContext}

Return structured JSON with all extracted concepts.`

    console.log(`[ConceptExtractor] Calling Gemini...`)

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: CONCEPT_EXTRACTION_SCHEMA,
      },
    })

    if (!response.text) {
      throw new Error('No response from Gemini AI')
    }

    console.log(`[ConceptExtractor] Received response, parsing...`)

    // Parse response
    let cleanedText = response.text.trim()
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const extractionResult: ExtractionResult = JSON.parse(cleanedText)
    console.log(`[ConceptExtractor] Extracted ${extractionResult.concepts.length} concepts`)

    // Get all existing concept hashes for deduplication
    const existingConcepts = await prisma.conceptBank.findMany({
      select: { conceptHash: true, id: true }
    })
    const existingHashes = new Set(existingConcepts.map(c => c.conceptHash))

    // Process and save concepts
    let created = 0
    let duplicates = 0
    const postIds = posts.map(p => p.id)

    for (const concept of extractionResult.concepts) {
      const conceptHash = generateConceptHash(concept.concept, concept.explanation)

      if (existingHashes.has(conceptHash)) {
        // Concept already exists - update sourcePostIds if needed
        duplicates++
        const existing = await prisma.conceptBank.findUnique({
          where: { conceptHash }
        })
        if (existing) {
          const currentPostIds = existing.sourcePostIds || []
          const newPostIds = [...new Set([...currentPostIds, ...postIds])]
          if (newPostIds.length > currentPostIds.length) {
            await prisma.conceptBank.update({
              where: { conceptHash },
              data: { sourcePostIds: newPostIds }
            })
          }
        }
        continue
      }

      // Create new concept
      await prisma.conceptBank.create({
        data: {
          concept: concept.concept,
          insiderTerm: concept.insiderTerm || null,
          explanation: concept.explanation,
          consequence: concept.consequence || null,
          viralAngle: concept.viralAngle || null,
          proofPhrase: concept.proofPhrase || null,
          credibilitySource: concept.credibilitySource || null,
          category: concept.category as ConceptCategory,
          source,
          sourcePostIds: postIds,
          conceptHash,
          freshness: 'HIGH',
          timesUsed: 0,
          isActive: true
        }
      })

      created++
      existingHashes.add(conceptHash) // Prevent duplicates within same batch
    }

    console.log(`[ConceptExtractor] Created ${created} new concepts, ${duplicates} duplicates skipped`)

    return {
      created,
      duplicates,
      concepts: extractionResult.concepts
    }

  } catch (error) {
    console.error(`[ConceptExtractor] Failed:`, error)
    Sentry.captureException(error, {
      tags: { operation: 'concept_extraction' }
    })
    throw error
  }
}

// Get concepts for content generation
export async function getConceptsForGeneration(options: {
  count?: number
  excludeIds?: string[]
  preferFresh?: boolean
  categories?: ConceptCategory[]
}): Promise<Array<{
  id: string
  concept: string
  insiderTerm: string | null
  explanation: string
  consequence: string | null
  viralAngle: string | null
  proofPhrase: string | null
  credibilitySource: string | null
  category: ConceptCategory
}>> {
  const { count = 4, excludeIds = [], preferFresh = true, categories } = options

  const concepts = await prisma.conceptBank.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeIds },
      ...(categories ? { category: { in: categories } } : {}),
      ...(preferFresh ? { freshness: { in: ['HIGH', 'MEDIUM'] } } : {})
    },
    orderBy: preferFresh
      ? [{ freshness: 'asc' }, { timesUsed: 'asc' }, { createdAt: 'desc' }]
      : [{ timesUsed: 'asc' }],
    take: count * 2, // Get more than needed for randomization
    select: {
      id: true,
      concept: true,
      insiderTerm: true,
      explanation: true,
      consequence: true,
      viralAngle: true,
      proofPhrase: true,
      credibilitySource: true,
      category: true
    }
  })

  // Shuffle and take requested count
  const shuffled = concepts.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Update concept usage after generation
export async function updateConceptUsage(conceptIds: string[]): Promise<void> {
  const now = new Date()

  for (const id of conceptIds) {
    const concept = await prisma.conceptBank.findUnique({
      where: { id },
      select: { timesUsed: true }
    })

    if (concept) {
      const newTimesUsed = concept.timesUsed + 1

      // Calculate new freshness
      let freshness: ConceptFreshness = 'HIGH'
      if (newTimesUsed >= 10) {
        freshness = 'LOW'
      } else if (newTimesUsed >= 3) {
        freshness = 'MEDIUM'
      }

      await prisma.conceptBank.update({
        where: { id },
        data: {
          timesUsed: newTimesUsed,
          lastUsedAt: now,
          freshness
        }
      })
    }
  }
}

// Refresh freshness scores for all concepts
export async function refreshFreshnessScores(): Promise<{ updated: number }> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Reset concepts not used in 30 days to HIGH freshness
  const result = await prisma.conceptBank.updateMany({
    where: {
      OR: [
        { lastUsedAt: null },
        { lastUsedAt: { lt: thirtyDaysAgo } }
      ],
      freshness: { not: 'HIGH' }
    },
    data: {
      freshness: 'HIGH'
    }
  })

  return { updated: result.count }
}
