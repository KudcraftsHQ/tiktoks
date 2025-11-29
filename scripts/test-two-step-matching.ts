/**
 * Test script for Two-Step Smart Auto-Fill
 *
 * Step 1: AI selects relevant CONCEPTS based on hook (lightweight - just titles/coreMessages)
 * Step 2: AI picks best EXAMPLE within each selected concept
 *
 * Run with: bun scripts/test-two-step-matching.ts
 */

import { GoogleGenAI } from '@google/genai'
import { PrismaClient } from '../src/generated/prisma'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
const prisma = new PrismaClient()

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

interface SelectedExample {
  conceptId: string
  conceptTitle: string
  exampleId: string
  exampleText: string
  relevanceScore: number
  reason: string
}

// ============================================
// STEP 1: Select relevant concepts
// ============================================
async function selectRelevantConcepts(
  hookText: string,
  concepts: ConceptSummary[],
  numToSelect: number = 3
): Promise<SelectedConcept[]> {

  const prompt = `You are matching TikTok carousel CONTENT concepts to a HOOK slide.

HOOK:
"${hookText}"

Available CONTENT concepts:
${concepts.map((c, i) => `${i + 1}. "${c.title}" - ${c.coreMessage} (${c.exampleCount} examples)`).join('\n')}

TASK:
Select the ${numToSelect} concepts that would BEST deliver on what the HOOK promises.

Scoring:
- 1.0 = Perfect topical match
- 0.7-0.9 = Strong relevance
- 0.4-0.6 = Tangentially related
- Below 0.4 = Weak match

Return JSON (select exactly ${numToSelect}, sorted by relevanceScore descending):
{
  "selectedConcepts": [
    { "conceptIndex": 1, "relevanceScore": 0.9, "reason": "Brief explanation" },
    { "conceptIndex": 5, "relevanceScore": 0.8, "reason": "Brief explanation" },
    { "conceptIndex": 12, "relevanceScore": 0.7, "reason": "Brief explanation" }
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
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    return (parsed.selectedConcepts || []).map((s: any) => ({
      conceptId: concepts[s.conceptIndex - 1]?.id || '',
      relevanceScore: s.relevanceScore,
      reason: s.reason
    }))
  } catch (error) {
    console.error('Failed to parse:', responseText)
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
): Promise<{ exampleId: string; text: string; score: number; reason: string } | null> {

  if (examples.length === 0) return null

  // If only one example, just return it
  if (examples.length === 1) {
    return {
      exampleId: examples[0].id,
      text: examples[0].text,
      score: 0.8,  // Assume decent match since concept was selected
      reason: 'Only example in concept'
    }
  }

  const prompt = `You are selecting the best example from a concept for a TikTok carousel.

HOOK (what the carousel promises):
"${hookText}"

CONCEPT: "${concept.title}"
Core message: ${concept.coreMessage}

Available examples:
${examples.map((e, i) => `${i + 1}. "${e.text.slice(0, 200)}${e.text.length > 200 ? '...' : ''}"`).join('\n\n')}

TASK:
Select the ONE example that best delivers on what the HOOK promises.

Return JSON:
{
  "selectedIndex": 1,
  "relevanceScore": 0.9,
  "reason": "Brief explanation of why this example fits the hook"
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

    if (!selectedExample) return null

    return {
      exampleId: selectedExample.id,
      text: selectedExample.text,
      score: parsed.relevanceScore,
      reason: parsed.reason
    }
  } catch (error) {
    console.error('Failed to parse:', responseText)
    return null
  }
}

// ============================================
// STEP 3 (Optional): Generate example if no good match
// ============================================
async function generateExample(
  hookText: string,
  concept: { title: string; coreMessage: string },
  existingExamples: { text: string }[]
): Promise<string> {

  const prompt = `Generate a TikTok carousel CONTENT slide that:
1. Delivers on this HOOK's promise: "${hookText}"
2. Fits this concept: "${concept.title}" - ${concept.coreMessage}

Style reference from existing examples:
${existingExamples.slice(0, 2).map(e => `- "${e.text.slice(0, 100)}..."`).join('\n')}

Requirements:
- Concise TikTok carousel text
- Casual, informative style
- Directly address what the hook promised

Return ONLY the slide text.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }]
  })

  return response.text?.trim() || ''
}

// ============================================
// Full Two-Step Test
// ============================================
async function runTwoStepTest() {
  console.log('=== Two-Step Smart Auto-Fill Test ===\n')

  // Load all CONTENT concepts with examples
  const allConcepts = await prisma.conceptBank.findMany({
    where: { type: 'CONTENT', isActive: true },
    include: {
      examples: { select: { id: true, text: true } },
      _count: { select: { examples: true } }
    }
  })

  const conceptSummaries: ConceptSummary[] = allConcepts.map(c => ({
    id: c.id,
    title: c.title,
    coreMessage: c.coreMessage,
    exampleCount: c._count.examples
  }))

  console.log(`Loaded ${conceptSummaries.length} CONTENT concepts\n`)

  // Test cases
  const testCases = [
    {
      hook: "i hopped on a call with someone from tiktok's integrity team… and the way they analyze your first 200 viewers shocked me…",
      slidesToFill: 3
    },
    {
      hook: "why deleting videos kills your account...",
      slidesToFill: 2
    },
    {
      hook: "the posting schedule that got me 100k followers...",
      slidesToFill: 3
    }
  ]

  for (const testCase of testCases) {
    console.log('━'.repeat(60))
    console.log(`\n📌 HOOK: "${testCase.hook.slice(0, 70)}..."`)
    console.log(`   Slides to fill: ${testCase.slidesToFill}\n`)

    // STEP 1: Select relevant concepts
    console.log('STEP 1: Selecting relevant concepts...')
    const startStep1 = Date.now()

    const selectedConcepts = await selectRelevantConcepts(
      testCase.hook,
      conceptSummaries,
      testCase.slidesToFill
    )

    const step1Time = Date.now() - startStep1
    console.log(`   ⏱️  Step 1 took ${step1Time}ms\n`)

    for (const selected of selectedConcepts) {
      const concept = allConcepts.find(c => c.id === selected.conceptId)
      console.log(`   ✓ Score ${selected.relevanceScore.toFixed(2)}: "${concept?.title}"`)
      console.log(`     Reason: ${selected.reason}`)
    }

    // STEP 2: Select best example from each concept
    console.log('\nSTEP 2: Selecting best examples...')
    const startStep2 = Date.now()

    const results: SelectedExample[] = []

    for (const selected of selectedConcepts) {
      const concept = allConcepts.find(c => c.id === selected.conceptId)
      if (!concept) continue

      const bestExample = await selectBestExample(
        testCase.hook,
        { id: concept.id, title: concept.title, coreMessage: concept.coreMessage },
        concept.examples
      )

      if (bestExample) {
        results.push({
          conceptId: concept.id,
          conceptTitle: concept.title,
          exampleId: bestExample.exampleId,
          exampleText: bestExample.text,
          relevanceScore: bestExample.score,
          reason: bestExample.reason
        })
      }
    }

    const step2Time = Date.now() - startStep2
    console.log(`   ⏱️  Step 2 took ${step2Time}ms\n`)

    // Show results
    console.log('RESULTS:')
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      console.log(`\n   Slide ${i + 2} (Score ${r.relevanceScore.toFixed(2)}):`)
      console.log(`   Concept: "${r.conceptTitle}"`)
      console.log(`   Example: "${r.exampleText.slice(0, 100).replace(/\n/g, ' ')}..."`)
      console.log(`   Reason: ${r.reason}`)
    }

    // Check if any need generation
    const lowScoreResults = results.filter(r => r.relevanceScore < 0.5)
    if (lowScoreResults.length > 0) {
      console.log(`\n⚠️  ${lowScoreResults.length} result(s) below threshold - would trigger generation`)
    }

    console.log(`\n   📊 Total time: ${step1Time + step2Time}ms`)
    console.log(`   📊 API calls: ${1 + selectedConcepts.length} (1 for concepts + ${selectedConcepts.length} for examples)`)
    console.log('')
  }
}

// ============================================
// Token Usage Comparison
// ============================================
async function compareTokenUsage() {
  console.log('\n=== Token Usage Comparison ===\n')

  const allConcepts = await prisma.conceptBank.findMany({
    where: { type: 'CONTENT', isActive: true },
    include: { examples: { select: { text: true } } }
  })

  // Old approach: All examples
  const allExamplesText = allConcepts.flatMap(c =>
    c.examples.map(e => e.text)
  ).join('\n')

  // New approach: Just concept summaries
  const conceptSummariesText = allConcepts.map(c =>
    `"${c.title}" - ${c.coreMessage}`
  ).join('\n')

  // Rough token estimate (1 token ≈ 4 chars)
  const oldTokens = Math.round(allExamplesText.length / 4)
  const newTokens = Math.round(conceptSummariesText.length / 4)

  console.log('Old approach (all examples in one call):')
  console.log(`   ~${oldTokens.toLocaleString()} tokens`)
  console.log(`   ${allConcepts.reduce((sum, c) => sum + c.examples.length, 0)} examples`)

  console.log('\nNew approach (concept summaries only):')
  console.log(`   ~${newTokens.toLocaleString()} tokens`)
  console.log(`   ${allConcepts.length} concept summaries`)

  console.log(`\n📉 Token reduction: ${((1 - newTokens / oldTokens) * 100).toFixed(0)}%`)
}

async function main() {
  try {
    await runTwoStepTest()
    await compareTokenUsage()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
