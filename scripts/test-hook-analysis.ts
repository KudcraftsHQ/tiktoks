/**
 * Test script for AI Hook Analysis
 *
 * Tests whether the AI can correctly:
 * 1. Determine if a HOOK is SPECIFIC (makes concrete promise) or GENERIC (open-ended)
 * 2. Extract key themes that content slides must address
 * 3. Describe what content should follow
 *
 * Run with: bun scripts/test-hook-analysis.ts
 */

import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

interface HookAnalysis {
  specificity: 'SPECIFIC' | 'GENERIC'
  keyThemes: string[]
  contentRequirements: string
}

interface TestCase {
  hook: string
  expectedSpecificity: 'SPECIFIC' | 'GENERIC'
  description: string
  mustIncludeThemes?: string[]  // Themes that MUST be in keyThemes
}

const testCases: TestCase[] = [
  {
    hook: "i hopped on a call with someone from tiktok's integrity team… and the way they analyze your first 200 viewers shocked me…",
    expectedSpecificity: 'SPECIFIC',
    description: "Specific promise about '200 viewers' analysis",
    mustIncludeThemes: ['200', 'viewer']
  },
  {
    hook: "i hopped on a call with someone from tiktok's integrity team… and here is what i learned...",
    expectedSpecificity: 'GENERIC',
    description: "Open-ended 'what I learned' - any TikTok tip works"
  },
  {
    hook: "ive been a tiktok intern for 5 months, heres what shocked me about the algorithm...",
    expectedSpecificity: 'GENERIC',
    description: "Open-ended algorithm insights - broad content works"
  },
  {
    hook: "why your videos die after 200 views...",
    expectedSpecificity: 'SPECIFIC',
    description: "Specific promise about the '200 view' threshold",
    mustIncludeThemes: ['200', 'view']
  },
  {
    hook: "common mistakes i see small creators make on tiktok...",
    expectedSpecificity: 'GENERIC',
    description: "Generic 'mistakes' format - any creator mistake works"
  },
  {
    hook: "the 3 things that killed my first 10 videos...",
    expectedSpecificity: 'SPECIFIC',
    description: "Specific number (3) and topic (first 10 videos)",
    mustIncludeThemes: ['3', 'first']
  },
  {
    hook: "i literally copied the strategy of a creator with 1M followers for 30 days, heres what ive learned...",
    expectedSpecificity: 'GENERIC',
    description: "Although specific setup, the 'learned' is open-ended"
  },
  {
    hook: "the exact posting schedule that got me 100k followers in 3 months...",
    expectedSpecificity: 'SPECIFIC',
    description: "Promises specific 'posting schedule' content",
    mustIncludeThemes: ['posting', 'schedule']
  },
  {
    hook: "stop doing these 5 things if you want to grow on tiktok...",
    expectedSpecificity: 'SPECIFIC',
    description: "Promises exactly 5 specific things",
    mustIncludeThemes: ['5']
  },
  {
    hook: "things i wish i knew before starting on tiktok...",
    expectedSpecificity: 'GENERIC',
    description: "Open-ended 'wish I knew' - any beginner tip works"
  }
]

async function analyzeHook(hookText: string): Promise<HookAnalysis> {
  const prompt = `You are analyzing TikTok carousel HOOK slides to determine if they create SPECIFIC obligations or are GENERIC/open-ended.

HOOK TEXT:
"${hookText}"

## Classification Rules:

SPECIFIC hooks create a CONCRETE, NARROW obligation. The content slides MUST address a particular topic and CANNOT be substituted with general advice. Examples:
- "the way they analyze your first 200 viewers shocked me" → SPECIFIC (content MUST be about the 200 viewer analysis specifically)
- "why your videos die after 200 views" → SPECIFIC (content MUST explain the 200 view threshold)
- "the 3 things that killed my first 10 videos" → SPECIFIC (MUST be exactly 3 specific things)
- "the exact posting schedule that got me 100k" → SPECIFIC (MUST reveal a specific schedule)

GENERIC hooks are OPEN-ENDED. Many different types of content could satisfy them. Examples:
- "here is what I learned" → GENERIC (any learnings work)
- "what shocked me about the algorithm" → GENERIC (any algorithm insight works)
- "common mistakes creators make" → GENERIC (any mistake works)
- "things I wish I knew" → GENERIC (any tips work)
- "heres what ive learned" → GENERIC (any learnings work)

## Key Distinction:
- "what shocked me about the 200 viewer rule" → SPECIFIC (must be about 200 viewers)
- "what shocked me about the algorithm" → GENERIC (any algorithm shock works)

The difference is whether the hook LOCKS you into a specific topic or leaves it open.

## Phrases that indicate GENERIC:
- "here's what I learned"
- "what shocked me about [broad topic]"
- "common mistakes"
- "things I wish I knew"
- "what I discovered"

## Phrases that indicate SPECIFIC:
- Specific numbers that must be explained ("5 things", "200 views")
- Promises of exact methods ("the exact schedule", "the specific strategy")
- Narrow topics that require specific content ("why videos die after 200 views")

Return ONLY valid JSON:
{
  "specificity": "SPECIFIC" or "GENERIC",
  "keyThemes": ["theme1", "theme2"],
  "contentRequirements": "What content must deliver"
}`

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user' as const,
      parts: [{ text: prompt }]
    }]
  })

  const responseText = response.text || ''

  // Parse JSON from response
  try {
    // Handle potential markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('No JSON found in response')
  } catch (error) {
    console.error('Failed to parse response:', responseText)
    throw error
  }
}

async function runTests() {
  console.log('=== Hook Analysis Test Suite (v2) ===\n')

  let passed = 0
  let failed = 0
  const failures: { hook: string; expected: string; got: string }[] = []

  for (const testCase of testCases) {
    const shortHook = testCase.hook.slice(0, 60) + (testCase.hook.length > 60 ? '...' : '')
    console.log(`Testing: "${shortHook}"`)
    console.log(`Expected: ${testCase.expectedSpecificity} - ${testCase.description}`)

    try {
      const result = await analyzeHook(testCase.hook)

      // Check specificity
      const specificityMatch = result.specificity === testCase.expectedSpecificity

      // Check required themes (if any)
      let themesMatch = true
      if (testCase.mustIncludeThemes) {
        const themesLower = result.keyThemes.map(t => t.toLowerCase()).join(' ')
        for (const required of testCase.mustIncludeThemes) {
          if (!themesLower.includes(required.toLowerCase())) {
            themesMatch = false
            break
          }
        }
      }

      const testPassed = specificityMatch && themesMatch

      if (testPassed) {
        console.log(`✅ PASSED`)
        passed++
      } else {
        console.log(`❌ FAILED`)
        if (!specificityMatch) {
          console.log(`   Got specificity: ${result.specificity}`)
          failures.push({
            hook: testCase.hook,
            expected: testCase.expectedSpecificity,
            got: result.specificity
          })
        }
        if (!themesMatch && testCase.mustIncludeThemes) {
          console.log(`   Missing required themes: ${testCase.mustIncludeThemes.join(', ')}`)
          console.log(`   Got themes: ${result.keyThemes.join(', ')}`)
        }
        failed++
      }

      console.log(`   Themes: ${result.keyThemes.join(', ')}`)
      console.log(`   Requirements: ${result.contentRequirements.slice(0, 100)}...`)
      console.log('')

      // Rate limit - small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.log(`❌ ERROR: ${error}`)
      failed++
      console.log('')
    }
  }

  console.log('=== Summary ===')
  console.log(`Passed: ${passed}/${testCases.length}`)
  console.log(`Failed: ${failed}/${testCases.length}`)
  console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`)

  if (failures.length > 0) {
    console.log('\n=== Failures ===')
    for (const f of failures) {
      console.log(`Hook: "${f.hook.slice(0, 50)}..."`)
      console.log(`  Expected: ${f.expected}, Got: ${f.got}`)
    }
  }
}

runTests().catch(console.error)
