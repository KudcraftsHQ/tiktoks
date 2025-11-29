# Smart Auto-Fill: Context-Aware Example Selection

## Problem Statement

When a user picks a specific HOOK slide example, the current auto-fill feature picks random CONTENT/CTA examples. This creates mismatched carousels where:

### Example of the Problem:

**HOOK Selected:**
> "i hopped on a call with someone from tiktok's integrity team… and the way they analyze your first 200 viewers shocked me…"

This HOOK creates a **specific promise** about "first 200 viewers" - the content slides MUST deliver on this promise.

**Current Random Fill Result:**
- Slide 2: Random fact about "over-editing kills momentum" ❌
- Slide 3: Random fact about "don't delete bad videos" ❌
- Slide 4: Random CTA about "use apps to analyze" ❌

None of these deliver on the "200 viewers" promise!

### Contrast with a Generic HOOK:

**HOOK:**
> "i hopped on a call with someone from tiktok's integrity team… and here is what i learned..."

This HOOK is **open-ended** - any TikTok-related insights would work.

---

## Current Data Analysis

From the database exploration:

| Type | Count | Total Examples |
|------|-------|----------------|
| HOOK | 5 concepts | ~29 examples |
| CONTENT | 38 concepts | ~194 examples |
| CTA | 1 concept | 62 examples |

**Key observations:**
1. HOOK concepts vary from specific ("200 viewers analysis") to generic ("what I learned")
2. CONTENT concepts are broad - some relate to specific topics, others are universal advice
3. CTA has only 1 concept - always about "use platform tools"

---

## Proposed Solution: AI-Powered Smart Auto-Fill

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Picks HOOK Example                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              1. Analyze HOOK for Promise/Topic                   │
│   - Extract key themes (e.g., "200 viewers", "first viewers")   │
│   - Determine specificity level (SPECIFIC vs GENERIC)           │
│   - Identify what content should deliver                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. Match Concepts & Examples to Promise             │
│   IF SPECIFIC:                                                   │
│     - Search for concepts matching the promise theme            │
│     - Rank examples by semantic relevance to HOOK               │
│     - If no matches: Generate custom examples (see step 3)      │
│   IF GENERIC:                                                    │
│     - Can use broader concept selection                          │
│     - Still prefer thematically related content                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           3. Handle Missing Relevant Examples                    │
│   Option A: Generate AI example for existing concept            │
│   Option B: Create new concept + example on-the-fly             │
│   Option C: Flag to user that no matching content exists        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. Fill Slides with Results                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: AI Hook Analysis & Example Matching

**New API Endpoint:** `POST /api/remixes/[id]/smart-auto-fill`

**Request Body:**
```typescript
{
  hookText: string;          // The selected HOOK slide text
  hookConceptId?: string;    // Optional: the concept the HOOK came from
}
```

**AI Analysis Step:**

```typescript
const analysisPrompt = `
Analyze this TikTok carousel HOOK slide:
"${hookText}"

Determine:
1. SPECIFICITY: Is this SPECIFIC (makes a concrete promise) or GENERIC (open-ended)?
2. KEY_THEMES: What specific topics/keywords must the content slides address?
3. CONTENT_REQUIREMENTS: What type of information should follow this hook?

Examples:
- "the way they analyze your first 200 viewers shocked me"
  → SPECIFIC, themes: ["200 viewers", "first viewers", "how TikTok analyzes viewers"]

- "here is what I learned"
  → GENERIC, themes: ["TikTok tips", "creator insights"]

Return JSON:
{
  "specificity": "SPECIFIC" | "GENERIC",
  "keyThemes": ["theme1", "theme2"],
  "contentRequirements": "Description of what content should deliver"
}
`;
```

### Phase 2: Smart Example Selection

**For SPECIFIC hooks:**

1. **Semantic Search** - Score each CONTENT concept/example against the key themes
2. **Ranking Algorithm:**
   ```typescript
   score = (
     themeMatchScore * 0.6 +      // How well does it match the hook's promise?
     conceptRelevanceScore * 0.3 + // Is the concept type appropriate?
     exampleQualityScore * 0.1     // View count, recency
   )
   ```
3. **Selection:** Pick top-scoring examples, ensuring variety across concepts

**For GENERIC hooks:**
- Use current random selection, but still prefer related concepts
- Weight by concept usage stats (more used = proven effective)

### Phase 3: Handle No Matches (AI Generation Fallback)

When no existing examples match the HOOK's promise:

**Option A: Generate for Existing Concept (Preferred)**
```typescript
const generatePrompt = `
The user is creating a TikTok carousel with this HOOK:
"${hookText}"

The HOOK promises content about: ${contentRequirements}

Generate a CONTENT slide example for this concept:
- Concept: "${matchingConcept.title}"
- Core Message: "${matchingConcept.coreMessage}"

Requirements:
1. MUST deliver on what the HOOK promised
2. Match the style of existing examples
3. Be concise (TikTok carousel text)

Return only the slide text.
`;
```

**Option B: User Notification**
If no concept is even close, notify the user:
- "No existing content matches this hook's promise. Would you like to generate new content?"

---

## API Design

### New Endpoint: `POST /api/remixes/[id]/smart-auto-fill`

```typescript
interface SmartAutoFillRequest {
  hookText: string;
  hookConceptId?: string;
  generateIfMissing?: boolean;  // Default: true
}

interface SmartAutoFillResponse {
  success: boolean;
  filledCount: number;
  results: Array<{
    slideIndex: number;
    text: string;
    conceptId: string;
    conceptTitle: string;
    exampleId: string | null;  // null if AI-generated
    matchScore: number;        // How well it matches the hook
    wasGenerated: boolean;     // true if AI-generated
  }>;
  analysis: {
    hookSpecificity: 'SPECIFIC' | 'GENERIC';
    keyThemes: string[];
    contentRequirements: string;
  };
}
```

### Concept Selection Logic

```typescript
async function selectConceptsForHook(
  hookText: string,
  hookAnalysis: HookAnalysis,
  availableConcepts: ConceptWithExamples[],
  slideCount: number
): Promise<SelectedConcepts[]> {

  if (hookAnalysis.specificity === 'GENERIC') {
    // For generic hooks, use weighted random (prefer high-performing concepts)
    return selectWeightedRandom(availableConcepts, slideCount);
  }

  // For specific hooks, use AI to rank concepts by relevance
  const rankedConcepts = await rankConceptsByRelevance(
    hookText,
    hookAnalysis.keyThemes,
    availableConcepts
  );

  // Select top concepts, ensuring variety
  return selectTopWithVariety(rankedConcepts, slideCount);
}
```

### Example Selection Within Concept

```typescript
async function selectBestExample(
  concept: ConceptWithExamples,
  hookText: string,
  keyThemes: string[]
): Promise<{ example: Example; score: number; wasGenerated: boolean }> {

  // Score each existing example
  const scoredExamples = await Promise.all(
    concept.examples.map(async (example) => ({
      example,
      score: await scoreExampleRelevance(example.text, hookText, keyThemes)
    }))
  );

  // Sort by score
  scoredExamples.sort((a, b) => b.score - a.score);

  const bestMatch = scoredExamples[0];

  // If best match is good enough, use it
  if (bestMatch && bestMatch.score >= RELEVANCE_THRESHOLD) {
    return { ...bestMatch, wasGenerated: false };
  }

  // Otherwise, generate a new example
  const generatedText = await generateExampleForConcept(
    concept,
    hookText,
    keyThemes
  );

  return {
    example: { id: null, text: generatedText },
    score: 1.0,  // AI-generated should be perfectly relevant
    wasGenerated: true
  };
}
```

---

## Testing Strategy

### Test Script: Validate AI Hook Analysis

```typescript
// scripts/test-hook-analysis.ts

const testCases = [
  {
    hook: "i hopped on a call with someone from tiktok's integrity team… and the way they analyze your first 200 viewers shocked me…",
    expectedSpecificity: "SPECIFIC",
    expectedThemes: ["200 viewers", "first viewers", "algorithm analysis"]
  },
  {
    hook: "i hopped on a call with someone from tiktok's integrity team… and here is what i learned...",
    expectedSpecificity: "GENERIC",
    expectedThemes: ["TikTok", "creator tips"]
  },
  {
    hook: "ive been a tiktok intern for 5 months, heres what shocked me about the algorithm...",
    expectedSpecificity: "GENERIC",
    expectedThemes: ["algorithm", "TikTok tips"]
  },
  {
    hook: "why your videos die after 200 views...",
    expectedSpecificity: "SPECIFIC",
    expectedThemes: ["200 views", "video performance", "view threshold"]
  }
];
```

### Test Script: Validate Example Matching

```typescript
// scripts/test-example-matching.ts

// Given a specific HOOK, verify the selected examples are relevant
const hookText = "the way they analyze your first 200 viewers shocked me";

// After smart-fill, check:
// 1. Do all filled examples relate to viewer analysis?
// 2. Do they deliver on the "200 viewers" promise?
// 3. Are they from appropriate concepts?
```

---

## Migration Path

### Phase 1: Add Smart Auto-Fill (Non-Breaking)
- Create new `/api/remixes/[id]/smart-auto-fill` endpoint
- Add "Smart Fill" button alongside existing "Auto Fill"
- Test with real users, gather feedback

### Phase 2: Improve Based on Feedback
- Tune relevance thresholds
- Add more sophisticated matching
- Improve AI generation quality

### Phase 3: Replace Default (Optional)
- Make smart-fill the default
- Keep random-fill as "Quick Fill" option for generic content

---

## Open Questions

1. **Should AI-generated examples be saved?**
   - Pro: Builds concept bank over time
   - Con: Could pollute with low-quality content
   - Recommendation: Save as `AI_GENERATED` source type, allow user curation

2. **Relevance threshold value?**
   - Start with 0.6 (60% confidence required)
   - Tune based on user feedback

3. **Handling CTA slides?**
   - Currently only 1 CTA concept - always use it
   - Could add AI generation for CTA matching hook theme

4. **Performance concerns?**
   - AI calls add latency
   - Consider caching hook analysis results
   - Batch concept/example scoring

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/app/api/remixes/[id]/smart-auto-fill/route.ts` | **NEW** - Main endpoint |
| `src/lib/hook-analysis-service.ts` | **NEW** - AI hook analysis |
| `src/lib/example-matching-service.ts` | **NEW** - Semantic matching |
| `src/components/ConceptQuickSelector.tsx` | Update to call smart-auto-fill |
| `src/components/ProjectPostsTable.tsx` | Pass hook text to auto-fill |
| `scripts/test-hook-analysis.ts` | **NEW** - Testing script |
| `scripts/test-example-matching.ts` | **NEW** - Testing script |

---

## Test Results

### Hook Analysis Test (v2)
- **Success Rate: 60%** (6/10 tests passed)
- AI correctly identifies GENERIC vs SPECIFIC in most cases
- Some edge cases where "here's what I learned" after specific setup is still marked SPECIFIC
- Theme extraction works but doesn't always include exact numbers

### Example Matching Test
- **Works excellently!** AI correctly:
  - Ranks examples by relevance to hook promise
  - Finds near-perfect matches (score 1.0) when they exist (e.g., "deleting videos" hook → "don't delete videos" examples)
  - Generates coherent new examples when needed

### Key Insight from Testing
The **example matching** is the more critical part. Even if we don't perfectly classify SPECIFIC vs GENERIC, the AI does a great job ranking existing examples by relevance to the hook.

**Simplified Approach:**
- Skip the SPECIFIC/GENERIC classification
- Just use AI to rank examples by relevance to the selected HOOK
- Pick top-scoring examples instead of random
- Only generate new examples if nothing scores above threshold (0.5)

---

## Next Steps

1. ✅ Analyze current data (done)
2. ✅ Design API structure (done)
3. ✅ Create test scripts to validate AI behavior (done)
   - `scripts/test-hook-analysis.ts` - Tests specificity classification
   - `scripts/test-example-matching.ts` - Tests example ranking & generation
   - `scripts/test-two-step-matching.ts` - Tests two-step concept→example selection
4. ✅ Implement smart-auto-fill endpoint
   - `src/app/api/remixes/[id]/smart-auto-fill/route.ts`
5. ✅ Update UI to pass hook text to auto-fill
   - `src/components/ConceptQuickSelector.tsx` - Passes hook text when triggering auto-fill
   - `src/components/ProjectPostsTable.tsx` - Calls smart endpoint when hookText provided
6. 🔲 Test with real carousels (manual testing needed)

## Implementation Summary

### How It Works Now

1. User picks a HOOK example on slide 0
2. `ConceptQuickSelector` calls `onAutoFill(example.text)` after apply
3. `ProjectPostsTable.handleAutoFillSlides` receives hook text
4. If hook text provided → calls `/api/remixes/[id]/smart-auto-fill`
5. If no hook text → falls back to `/api/remixes/[id]/auto-fill-concepts` (random)

### Smart Auto-Fill Flow

```
POST /api/remixes/{draftId}/smart-auto-fill
{ hookText: "the way they analyze your first 200 viewers..." }
```

**Step 1**: AI selects 3 most relevant CONTENT concepts based on hook
**Step 2**: For each concept, AI picks the best matching example
**Step 3**: If example score < 0.5, generates a new example and saves it

### Toast Messages

- Smart fill: "Smart-filling slides based on hook..."
- Success (smart): "Filled 3 slides with matched examples"
- Success (with generation): "Filled 3 slides (1 AI-generated)"
- Random fill: "Filled 3 slides with random examples"
