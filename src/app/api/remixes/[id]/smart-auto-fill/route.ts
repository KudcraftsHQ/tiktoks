/**
 * Smart Auto-Fill API endpoint
 *
 * Uses AI to select content that matches the HOOK slide's promise.
 * Two-step approach:
 * 1. Select relevant CONCEPTS based on hook text
 * 2. Pick best EXAMPLE from each selected concept
 *
 * Falls back to AI generation if no good matches exist.
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { GoogleGenAI } from '@google/genai'

const prisma = new PrismaClient()
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

const RELEVANCE_THRESHOLD = 0.5

interface SmartAutoFillResult {
  slideIndex: number
  text: string
  conceptId: string
  conceptTitle: string
  exampleId: string | null
  exampleIds: string[]
  relevanceScore: number
  wasGenerated: boolean
}

interface ConceptSummary {
  id: string
  title: string
  coreMessage: string
  exampleCount: number
}

interface SelectedConcept {
  conceptId: string
  relevanceScore: number
  reason: string
}

// ============================================
// STEP 1: Select relevant concepts via AI
// ============================================
async function selectRelevantConcepts(
  hookText: string,
  concepts: ConceptSummary[],
  numToSelect: number
): Promise<SelectedConcept[]> {
  const prompt = `You are matching TikTok carousel CONTENT concepts to a HOOK slide.

HOOK:
"${hookText}"

Available CONTENT concepts:
${concepts.map((c, i) => `${i + 1}. "${c.title}" - ${c.coreMessage} (${c.exampleCount} examples)`).join('\n')}

TASK:
Select the ${numToSelect} concepts that would BEST deliver on what the HOOK promises.
Ensure VARIETY - pick different concepts, not the same topic multiple times.

Scoring:
- 1.0 = Perfect topical match
- 0.7-0.9 = Strong relevance
- 0.4-0.6 = Tangentially related
- Below 0.4 = Weak match

Return JSON (select exactly ${numToSelect}, sorted by relevanceScore descending):
{
  "selectedConcepts": [
    { "conceptIndex": 1, "relevanceScore": 0.9, "reason": "Brief explanation" }
  ]
}

Return ONLY valid JSON.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }]
  })

  const responseText = response.text || ''

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in AI response')

    const parsed = JSON.parse(jsonMatch[0])

    return (parsed.selectedConcepts || []).map((s: any) => ({
      conceptId: concepts[s.conceptIndex - 1]?.id || '',
      relevanceScore: s.relevanceScore,
      reason: s.reason
    })).filter((s: SelectedConcept) => s.conceptId)
  } catch (error) {
    console.error('[SmartAutoFill] Failed to parse concept selection:', responseText)
    throw error
  }
}

// ============================================
// STEP 2: Select best example from a concept
// ============================================
async function selectBestExample(
  hookText: string,
  concept: { id: string; title: string; coreMessage: string },
  examples: { id: string; text: string }[]
): Promise<{ exampleId: string; text: string; score: number } | null> {
  if (examples.length === 0) return null

  // Single example - just return it
  if (examples.length === 1) {
    return {
      exampleId: examples[0].id,
      text: examples[0].text,
      score: 0.8
    }
  }

  const prompt = `You are selecting the best example from a concept for a TikTok carousel.

HOOK (what the carousel promises):
"${hookText}"

CONCEPT: "${concept.title}"
Core message: ${concept.coreMessage}

Available examples:
${examples.map((e, i) => `${i + 1}. "${e.text.slice(0, 250)}${e.text.length > 250 ? '...' : ''}"`).join('\n\n')}

TASK:
Select the ONE example that best delivers on what the HOOK promises.

Return JSON:
{
  "selectedIndex": 1,
  "relevanceScore": 0.9
}

Return ONLY valid JSON.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }]
  })

  const responseText = response.text || ''

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])
    const selectedExample = examples[parsed.selectedIndex - 1]

    if (!selectedExample) {
      // Fallback to first example
      return {
        exampleId: examples[0].id,
        text: examples[0].text,
        score: 0.6
      }
    }

    return {
      exampleId: selectedExample.id,
      text: selectedExample.text,
      score: parsed.relevanceScore
    }
  } catch (error) {
    console.error('[SmartAutoFill] Failed to parse example selection:', responseText)
    // Fallback to first example
    return {
      exampleId: examples[0].id,
      text: examples[0].text,
      score: 0.5
    }
  }
}

// ============================================
// STEP 3: Generate example if no good match
// ============================================
async function generateExample(
  hookText: string,
  concept: { title: string; coreMessage: string },
  existingExamples: { text: string }[]
): Promise<string> {
  const prompt = `Generate a TikTok carousel CONTENT slide that:
1. Delivers on this HOOK's promise: "${hookText}"
2. Fits this concept: "${concept.title}" - ${concept.coreMessage}

${existingExamples.length > 0 ? `Style reference from existing examples:
${existingExamples.slice(0, 2).map(e => `- "${e.text.slice(0, 100)}..."`).join('\n')}` : ''}

Requirements:
- Concise TikTok carousel text (2-4 short lines)
- Casual, informative style
- Directly address what the hook promised
- No hashtags or emojis unless fitting the style

Return ONLY the slide text.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }]
  })

  return response.text?.trim() || ''
}

// ============================================
// Main API Handler
// ============================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params
    const body = await request.json()
    const { hookText, saveGeneratedExamples = true } = body

    if (!hookText || typeof hookText !== 'string') {
      return NextResponse.json(
        { error: 'hookText is required' },
        { status: 400 }
      )
    }

    console.log(`🎯 [SmartAutoFill] Starting for draft: ${draftId}`)
    console.log(`📌 Hook: "${hookText.slice(0, 60)}..."`)

    // Fetch draft
    const draft = await prisma.remixPost.findUnique({
      where: { id: draftId },
      select: {
        slides: true,
        slideClassifications: true
      }
    })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // Parse slides
    let slides: any[]
    try {
      slides = typeof draft.slides === 'string'
        ? JSON.parse(draft.slides)
        : Array.isArray(draft.slides) ? draft.slides : []
    } catch {
      return NextResponse.json({ error: 'Invalid slides data' }, { status: 500 })
    }

    const classifications = (draft.slideClassifications as any) || []

    // Helper to check if slide is empty
    const isSlideEmpty = (slide: any) => {
      const text = slide.paraphrasedText || ''
      return text.trim().length < 10
    }

    // Get slide type from classification
    const getSlideType = (index: number) => {
      if (!Array.isArray(classifications)) return undefined
      const classification = classifications.find((c: any) => c.slideIndex === index)
      return classification?.type?.toUpperCase()
    }

    // Find empty slides to fill (skip index 0 - HOOK)
    const emptySlideIndices = slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide, index }) => index > 0 && isSlideEmpty(slide))
      .map(({ index }) => index)

    if (emptySlideIndices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No empty slides to fill',
        filledCount: 0,
        results: []
      })
    }

    console.log(`[SmartAutoFill] Found ${emptySlideIndices.length} empty slides to fill`)

    // Fetch all CONTENT concepts with examples
    const contentConcepts = await prisma.conceptBank.findMany({
      where: { type: 'CONTENT', isActive: true },
      include: {
        examples: { select: { id: true, text: true } },
        _count: { select: { examples: true } }
      }
    })

    // Also fetch CTA concepts for the last slide
    const ctaConcepts = await prisma.conceptBank.findMany({
      where: { type: 'CTA', isActive: true },
      include: {
        examples: { select: { id: true, text: true } },
        _count: { select: { examples: true } }
      }
    })

    const contentSummaries: ConceptSummary[] = contentConcepts
      .filter(c => c._count.examples > 0)
      .map(c => ({
        id: c.id,
        title: c.title,
        coreMessage: c.coreMessage,
        exampleCount: c._count.examples
      }))

    if (contentSummaries.length === 0) {
      return NextResponse.json(
        { error: 'No CONTENT concepts with examples found' },
        { status: 400 }
      )
    }

    // STEP 1: Select relevant concepts for CONTENT slides
    const numContentSlides = emptySlideIndices.filter(i => {
      const type = getSlideType(i)
      return type !== 'CTA' && i !== slides.length - 1
    }).length

    let selectedConcepts: SelectedConcept[] = []
    if (numContentSlides > 0) {
      selectedConcepts = await selectRelevantConcepts(
        hookText,
        contentSummaries,
        Math.min(numContentSlides, contentSummaries.length)
      )
      console.log(`[SmartAutoFill] Selected ${selectedConcepts.length} concepts`)
    }

    // Process each empty slide
    const results: SmartAutoFillResult[] = []
    const updatedSlides = [...slides]
    const updatedClassifications = [...(Array.isArray(classifications) ? classifications : [])]
    let conceptIndex = 0

    for (const slideIndex of emptySlideIndices) {
      const slideType = getSlideType(slideIndex)
      const isLastSlide = slideIndex === slides.length - 1
      const isCTA = slideType === 'CTA' || isLastSlide

      let selectedConceptId: string
      let selectedConcept: typeof contentConcepts[0] | undefined
      let relevanceScore = 0.8

      if (isCTA && ctaConcepts.length > 0) {
        // Use CTA concept for last slide
        selectedConcept = ctaConcepts[0]
        selectedConceptId = selectedConcept.id
      } else if (selectedConcepts[conceptIndex]) {
        // Use AI-selected concept
        selectedConceptId = selectedConcepts[conceptIndex].conceptId
        selectedConcept = contentConcepts.find(c => c.id === selectedConceptId)
        relevanceScore = selectedConcepts[conceptIndex].relevanceScore
        conceptIndex++
      } else {
        // Fallback: pick random content concept
        selectedConcept = contentConcepts[Math.floor(Math.random() * contentConcepts.length)]
        selectedConceptId = selectedConcept?.id || ''
        relevanceScore = 0.5
      }

      if (!selectedConcept) {
        console.log(`[SmartAutoFill] No concept found for slide ${slideIndex}`)
        continue
      }

      // STEP 2: Select best example from concept
      let exampleText: string
      let exampleId: string | null = null
      let wasGenerated = false

      if (selectedConcept.examples.length > 0) {
        const bestExample = await selectBestExample(
          hookText,
          {
            id: selectedConcept.id,
            title: selectedConcept.title,
            coreMessage: selectedConcept.coreMessage
          },
          selectedConcept.examples
        )

        if (bestExample && bestExample.score >= RELEVANCE_THRESHOLD) {
          exampleText = bestExample.text
          exampleId = bestExample.exampleId
          relevanceScore = Math.min(relevanceScore, bestExample.score)
        } else {
          // STEP 3: Generate if below threshold
          console.log(`[SmartAutoFill] Low score (${bestExample?.score}), generating for slide ${slideIndex}`)
          exampleText = await generateExample(
            hookText,
            { title: selectedConcept.title, coreMessage: selectedConcept.coreMessage },
            selectedConcept.examples
          )
          wasGenerated = true

          // Save generated example if requested
          if (saveGeneratedExamples && exampleText.length > 10) {
            const newExample = await prisma.conceptExample.create({
              data: {
                conceptId: selectedConcept.id,
                text: exampleText,
                sourceType: 'AI_GENERATED'
              }
            })
            exampleId = newExample.id
            console.log(`[SmartAutoFill] Saved generated example: ${newExample.id}`)
          }
        }
      } else {
        // No examples - generate
        exampleText = await generateExample(
          hookText,
          { title: selectedConcept.title, coreMessage: selectedConcept.coreMessage },
          []
        )
        wasGenerated = true
      }

      // Update slide with text
      const textLines = exampleText.split('\n').filter(line => line.trim() !== '')
      const slide = slides[slideIndex]
      const updatedTextBoxes = textLines.map((line, idx) => {
        const existingTextBox = slide.textBoxes?.[idx]
        if (existingTextBox) {
          return { ...existingTextBox, text: line }
        }
        return {
          id: `text_${Date.now()}_${slideIndex}_${idx}`,
          text: line,
          x: 0.1,
          y: 0.3 + (idx * 0.15),
          width: 0.8,
          height: 0.12,
          fontSize: 44,
          fontFamily: 'Poppins',
          fontWeight: 'bold' as const,
          color: '#000000',
          textAlign: 'center' as const,
          backgroundColor: '#ffffff',
          backgroundOpacity: 1,
          borderRadius: 12,
          paddingTop: 24,
          paddingRight: 32,
          paddingBottom: 24,
          paddingLeft: 32,
          lineHeight: 1.2,
          zIndex: idx
        }
      })

      updatedSlides[slideIndex] = {
        ...slide,
        paraphrasedText: exampleText,
        textBoxes: updatedTextBoxes
      }

      // Update classification
      const classificationIndex = updatedClassifications.findIndex(
        (c: any) => c.slideIndex === slideIndex
      )
      if (classificationIndex !== -1) {
        updatedClassifications[classificationIndex] = {
          ...updatedClassifications[classificationIndex],
          conceptId: selectedConcept.id,
          conceptTitle: selectedConcept.title
        }
      }

      // Refresh examples list for exampleIds
      const refreshedConcept = await prisma.conceptBank.findUnique({
        where: { id: selectedConcept.id },
        include: { examples: { select: { id: true } } }
      })

      results.push({
        slideIndex,
        text: exampleText,
        conceptId: selectedConcept.id,
        conceptTitle: selectedConcept.title,
        exampleId,
        exampleIds: refreshedConcept?.examples.map(e => e.id) || [],
        relevanceScore,
        wasGenerated
      })
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No slides were filled',
        filledCount: 0,
        results: []
      })
    }

    // Update draft in database
    await prisma.$transaction(async (tx) => {
      await tx.remixPost.update({
        where: { id: draftId },
        data: {
          slides: JSON.stringify(updatedSlides),
          slideClassifications: updatedClassifications,
          updatedAt: new Date()
        }
      })

      // Increment concept usage counters
      const uniqueConceptIds = [...new Set(results.map(r => r.conceptId))]
      for (const conceptId of uniqueConceptIds) {
        await tx.conceptBank.update({
          where: { id: conceptId },
          data: {
            timesUsed: { increment: 1 },
            lastUsedAt: new Date()
          }
        })
      }
    })

    const generatedCount = results.filter(r => r.wasGenerated).length
    console.log(`✅ [SmartAutoFill] Filled ${results.length} slides (${generatedCount} generated)`)

    return NextResponse.json({
      success: true,
      filledCount: results.length,
      generatedCount,
      results
    })

  } catch (error) {
    console.error('[SmartAutoFill] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
