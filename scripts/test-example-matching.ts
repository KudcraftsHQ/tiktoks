/**
 * Test script for AI Example Matching
 *
 * Given a HOOK and available CONTENT examples, tests whether AI can:
 * 1. Rank examples by relevance to the HOOK's promise
 * 2. Identify when no existing examples match well
 * 3. Generate appropriate new examples when needed
 *
 * Run with: bun scripts/test-example-matching.ts
 */

import { GoogleGenAI } from '@google/genai'
import { PrismaClient } from '../src/generated/prisma'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
const prisma = new PrismaClient()

interface ExampleMatch {
  exampleId: string
  relevanceScore: number  // 0-1
  reason: string
}

interface MatchingResult {
  rankedExamples: ExampleMatch[]
  bestMatch: ExampleMatch | null
  needsGeneration: boolean
  generatedExample?: string
}

/**
 * Test case with a specific HOOK that requires relevant content
 */
async function testExampleMatching() {
  console.log('=== Example Matching Test ===\n')

  // Fetch all CONTENT concepts with examples
  const contentConcepts = await prisma.conceptBank.findMany({
    where: { type: 'CONTENT', isActive: true },
    include: {
      examples: {
        select: { id: true, text: true }
      }
    }
  })

  console.log(`Loaded ${contentConcepts.length} CONTENT concepts with ${contentConcepts.reduce((sum, c) => sum + c.examples.length, 0)} total examples\n`)

  // Test cases: hooks with expected matching behavior
  const testCases = [
    {
      hook: "i hopped on a call with someone from tiktok's integrity team… and the way they analyze your first 200 viewers shocked me…",
      description: "Should find examples about viewer analysis, first impressions, or algorithm scoring",
      expectedMatches: ['200', 'viewer', 'first', 'analyze', 'watch']
    },
    {
      hook: "the posting schedule that got me 100k followers...",
      description: "Should find examples about posting timing, consistency, scheduling",
      expectedMatches: ['post', 'schedul', 'consisten', 'time']
    },
    {
      hook: "why deleting videos kills your account...",
      description: "Should find examples about not deleting videos",
      expectedMatches: ['delet', 'video', 'trust', 'score']
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n📌 HOOK: "${testCase.hook.slice(0, 60)}..."`)
    console.log(`Expected to match: ${testCase.expectedMatches.join(', ')}\n`)

    // Build example list for AI
    const allExamples = contentConcepts.flatMap(c =>
      c.examples.map(e => ({
        conceptId: c.id,
        conceptTitle: c.title,
        exampleId: e.id,
        text: e.text
      }))
    )

    const result = await matchExamplesToHook(testCase.hook, allExamples.slice(0, 50)) // Limit for API

    console.log(`Top 5 matches:`)
    for (const match of result.rankedExamples.slice(0, 5)) {
      const example = allExamples.find(e => e.exampleId === match.exampleId)
      const shortText = example?.text.slice(0, 80).replace(/\n/g, ' ') || 'N/A'
      console.log(`  Score ${match.relevanceScore.toFixed(2)}: "${shortText}..."`)
      console.log(`    Reason: ${match.reason}`)
    }

    if (result.needsGeneration) {
      console.log(`\n⚠️ No good matches found. AI would generate a new example.`)
      if (result.generatedExample) {
        console.log(`Generated: "${result.generatedExample.slice(0, 100)}..."`)
      }
    } else {
      console.log(`\n✅ Best match found with score ${result.bestMatch?.relevanceScore.toFixed(2)}`)
    }
  }
}

async function matchExamplesToHook(
  hookText: string,
  examples: Array<{ conceptId: string; conceptTitle: string; exampleId: string; text: string }>
): Promise<MatchingResult> {

  const prompt = `You are matching TikTok carousel CONTENT examples to a HOOK slide.

HOOK:
"${hookText}"

Available CONTENT examples (conceptTitle -> example text):
${examples.map((e, i) => `${i + 1}. [${e.conceptTitle}] "${e.text.slice(0, 150)}..."`).join('\n')}

TASK:
Rate each example by how well it delivers on what the HOOK promises.

Scoring:
- 1.0 = Perfect match, directly addresses the hook's promise
- 0.7-0.9 = Good match, related topic
- 0.4-0.6 = Tangentially related
- 0.1-0.3 = Weak connection
- 0.0 = Completely unrelated

If NO example scores above 0.5, set "needsGeneration" to true and provide a generated example that WOULD match the hook perfectly.

Return JSON:
{
  "rankedExamples": [
    { "exampleIndex": 1, "relevanceScore": 0.8, "reason": "Brief explanation" },
    ...
  ],
  "needsGeneration": false,
  "generatedExample": null
}

Sort rankedExamples by relevanceScore descending. Only include top 10.
Return ONLY valid JSON.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user' as const,
      parts: [{ text: prompt }]
    }]
  })

  const responseText = response.text || ''

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    // Map example indices back to IDs
    const rankedExamples: ExampleMatch[] = (parsed.rankedExamples || []).map((r: any) => ({
      exampleId: examples[r.exampleIndex - 1]?.exampleId || '',
      relevanceScore: r.relevanceScore,
      reason: r.reason
    }))

    const bestMatch = rankedExamples[0]?.relevanceScore >= 0.5 ? rankedExamples[0] : null

    return {
      rankedExamples,
      bestMatch,
      needsGeneration: parsed.needsGeneration || !bestMatch,
      generatedExample: parsed.generatedExample
    }
  } catch (error) {
    console.error('Failed to parse:', responseText)
    throw error
  }
}

/**
 * Test example generation when no matches exist
 */
async function testExampleGeneration() {
  console.log('\n\n=== Example Generation Test ===\n')

  // Fetch a concept to generate for
  const concept = await prisma.conceptBank.findFirst({
    where: { type: 'CONTENT', isActive: true },
    include: { examples: { take: 2 } }
  })

  if (!concept) {
    console.log('No CONTENT concepts found')
    return
  }

  // A hook that probably won't have exact matches
  const hook = "the exact tool I use to analyze my first 200 viewers and why it changed everything..."

  console.log(`Concept: "${concept.title}"`)
  console.log(`Core message: "${concept.coreMessage}"`)
  console.log(`Hook: "${hook}"`)
  console.log('')

  const generated = await generateExampleForConcept(concept, hook)

  console.log(`Generated example:`)
  console.log(`"${generated}"`)
}

async function generateExampleForConcept(
  concept: { title: string; coreMessage: string; examples: { text: string }[] },
  hookText: string
): Promise<string> {

  const prompt = `Generate a TikTok carousel CONTENT slide that:
1. Delivers on this HOOK's promise: "${hookText}"
2. Fits this concept: "${concept.title}" - ${concept.coreMessage}

Example style from this concept:
${concept.examples.slice(0, 2).map(e => `- "${e.text.slice(0, 100)}..."`).join('\n')}

Requirements:
- Be concise (TikTok carousel text)
- Match the casual, informative style
- Directly address what the hook promised
- Stay within the concept's core message

Return ONLY the slide text, nothing else.`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user' as const,
      parts: [{ text: prompt }]
    }]
  })

  return response.text?.trim() || ''
}

async function main() {
  try {
    await testExampleMatching()
    await testExampleGeneration()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
