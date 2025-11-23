import { GoogleGenAI, Type } from '@google/genai'
import * as Sentry from '@sentry/nextjs'

// Structured output schema for content generation
const CONTENT_GENERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    variations: {
      type: Type.ARRAY,
      description: "Array of content variations generated",
      items: {
        type: Type.OBJECT,
        properties: {
          variationIndex: {
            type: Type.NUMBER,
            description: "Zero-based index of this variation"
          },
          slides: {
            type: Type.ARRAY,
            description: "Slides for this variation",
            items: {
              type: Type.OBJECT,
              properties: {
                slideIndex: {
                  type: Type.NUMBER,
                  description: "Zero-based index of the slide"
                },
                slideType: {
                  type: Type.STRING,
                  enum: ['hook', 'content', 'cta'],
                  description: "Type of slide: 'hook' (first slide), 'content' (middle slides), or 'cta' (call-to-action, usually second to last)"
                },
                text: {
                  type: Type.STRING,
                  description: "The text content for this slide"
                },
                sourcePostReference: {
                  type: Type.STRING,
                  description: "Optional reference to which source post inspired this slide (e.g., 'Post 1', 'Post 3')"
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Confidence score for this slide (0-1)"
                }
              },
              propertyOrdering: ['slideIndex', 'slideType', 'text', 'sourcePostReference', 'confidence']
            }
          },
          metadata: {
            type: Type.OBJECT,
            description: "Metadata about this variation",
            properties: {
              totalSlides: {
                type: Type.NUMBER,
                description: "Total number of slides in this variation"
              },
              mainTheme: {
                type: Type.STRING,
                description: "The main theme or topic of this variation"
              },
              description: {
                type: Type.STRING,
                description: "A cohesive narrative summary that paraphrases all slides content as one flowing story. This should read like a natural, engaging paragraph that captures the entire carousel journey from hook to conclusion."
              }
            },
            propertyOrdering: ['totalSlides', 'mainTheme', 'description']
          }
        },
        propertyOrdering: ['variationIndex', 'slides', 'metadata']
      }
    },
    generationMetadata: {
      type: Type.OBJECT,
      description: "Overall generation metadata",
      properties: {
        totalVariations: {
          type: Type.NUMBER,
          description: "Total number of variations generated"
        },
        generatedAt: {
          type: Type.STRING,
          description: "ISO timestamp of generation"
        },
        strategy: {
          type: Type.STRING,
          description: "Strategy used: 'remix' or 'inspired'"
        }
      },
      propertyOrdering: ['totalVariations', 'generatedAt', 'strategy']
    }
  },
  propertyOrdering: ['variations', 'generationMetadata']
}

export interface SourcePost {
  id: string
  description?: string | null
  contentType: string
  ocrTexts: Array<{ imageIndex: number; text: string; success: boolean }>
  imageDescriptions: Array<{ imageIndex: number; imageDescription: string; success: boolean }>
  slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }>
  category?: { id: string; name: string } | null
}

export interface ConceptBankItem {
  id: string
  title: string
  coreMessage: string
  type: string
  examples: Array<{ text: string }>
}

// Reference structure for following exact slide structure from source post
export interface ReferenceStructure {
  slideCount: number
  slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }>
  hookCount: number
  contentCount: number
  ctaCount: number
  conclusionCount: number
}

export interface GenerationConfig {
  sourcePosts: SourcePost[]
  productContext?: { title: string; description: string }
  generationStrategy: 'remix' | 'inspired'
  languageStyle: string
  contentIdeas?: string
  variationCount: number
  slidesRange: { min: number; max: number }
  concepts?: ConceptBankItem[]
  referenceStructure?: ReferenceStructure // Optional: when provided, follow this exact structure
}

export interface GeneratedSlide {
  slideIndex: number
  slideType: 'hook' | 'content' | 'cta'
  text: string
  sourcePostReference?: string
  confidence: number
}

export interface GeneratedVariation {
  variationIndex: number
  slides: GeneratedSlide[]
  metadata: {
    totalSlides: number
    mainTheme: string
    description: string
  }
}

export interface GenerationResult {
  variations: GeneratedVariation[]
  generationMetadata: {
    totalVariations: number
    generatedAt: string
    strategy: string
  }
}

function buildPrompt(config: GenerationConfig): string {
  const { sourcePosts, productContext, generationStrategy, languageStyle, contentIdeas, variationCount, slidesRange, concepts, referenceStructure } = config

  // Build source posts context
  const postsContext = sourcePosts.map((post, index) => {
    const postNum = index + 1
    const ocrText = post.ocrTexts
      .filter(t => t.success && t.text)
      .map(t => `Slide ${t.imageIndex + 1}: ${t.text}`)
      .join('\n')

    const descriptions = post.imageDescriptions
      .filter(d => d.success && d.imageDescription)
      .map(d => `Slide ${d.imageIndex + 1}: ${d.imageDescription}`)
      .join('\n')

    return `
**Reference Post ${postNum}** (${post.contentType})
- Category: ${post.category?.name || 'Uncategorized'}
- Description: ${post.description || 'No description'}
- OCR Texts:
${ocrText || 'No text extracted'}
- Visual Descriptions:
${descriptions || 'No descriptions available'}
`
  }).join('\n\n')

  // Product context section
  const productSection = productContext
    ? `\n**Product Context:**
${productContext.title}
${productContext.description}\n`
    : ''

  // Content ideas section
  const contentIdeasSection = contentIdeas
    ? `\n**Additional Content Ideas:**
${contentIdeas}\n`
    : ''

  // Concept Bank section - selected concepts to incorporate
  const conceptsSection = concepts && concepts.length > 0
    ? `\n**CONCEPT BANK - Incorporate These Patterns:**
The user has selected specific content patterns from their Concept Bank. You MUST incorporate these concepts into the generated content.

${concepts.map((concept, idx) => {
  const examplesText = concept.examples.length > 0
    ? `\n   Examples:\n${concept.examples.map(ex => `   - "${ex.text}"`).join('\n')}`
    : ''
  return `${idx + 1}. **[${concept.type}] ${concept.title}**
   Core Message: ${concept.coreMessage}${examplesText}`
}).join('\n\n')}

IMPORTANT: Use the concepts above as inspiration for the corresponding slide types:
- HOOK concepts should inform your hook/opening slides
- CONTENT concepts should guide your middle content slides
- CTA concepts should shape your call-to-action slides

Adapt the core messages to fit the context while maintaining their essence.
`
    : ''

  // Strategy description
  const strategyDescription = generationStrategy === 'remix'
    ? `Your goal is to **remix and paraphrase** the reference posts above. Keep the core structure, themes, and key messages, but rewrite the text in a fresh way while maintaining the essence of the original content.

**⚠️ CRITICAL - ANTI-COPY ENFORCEMENT (READ THIS FIRST) ⚠️**

This is the #1 rule. Violations will make the output useless.

**THE GOLDEN RULE:** You are a DIFFERENT PERSON who learned the same insights. You would NEVER say it the same way.

**PER-SLIDE VERIFICATION (Do this for EVERY slide before outputting):**
   Before writing each slide, ask yourself:
   1. "Does this share more than 3 consecutive words with the reference?" → If yes, REWRITE
   2. "Am I using the same sentence structure?" → If yes, RESTRUCTURE
   3. "Am I using the same example (e.g., 'morning makeup', 'drafts lose power')?" → If yes, REPLACE with different example
   4. "Would someone compare this to the reference and think I copied?" → If yes, START OVER

**WHAT TO EXTRACT vs WHAT TO CHANGE:**
   ✅ EXTRACT: The underlying CONCEPT (e.g., "drafts have timestamps")
   ❌ CHANGE: The exact wording, examples, metaphors, sentence structure

   Example - Reference says: "videos left in your drafts lose power. the system timestamps your draft when you create it"
   ❌ BAD (copying): "drafts lose power. the system timestamps them on creation"
   ✅ GOOD (rewriting): "sitting on content kills its potential. tiktok treats old drafts like yesterday's news"

**HOOK TRANSFORMATION IS MANDATORY:**
   The hook MUST use a completely different authority angle than the reference.
   Reference: "i got invited to visit tiktoks headquarters"
   ❌ BAD: "i visited tiktoks algorithm lab" (same angle - insider visit)
   ✅ GOOD: "i copied a creator with 1M followers for 30 days" (different angle - experiment)
   ✅ GOOD: "my toxic ex interned at tiktok" (different angle - secondhand insider)
   ✅ GOOD: "ive been posting daily since february" (different angle - personal experience)`
    : `Your goal is to **create new content inspired by** the reference posts above. Use them as inspiration for themes, structure, and style, but create completely new content that explores different angles, examples, or perspectives.`

  // Hook examples for the model to learn from
  const hookExamplesSection = `
**HOOK SLIDE FORMULA (CRITICAL - Study These Patterns):**

Reference examples from successful viral content:
   - "i got invited to visit tiktoks headquarters, heres everything they revealed about the algorithm..."
   - "ive been posting consistently for 5 months, here's what ive discovered..."
   - "i literally copied the strategy of a creator with 1M followers for 30 days, heres what ive learned..."
   - "my toxic ex interned at tiktok for 5 months and now im exposing everything he told me..."
   - "ive been a tiktok intern for 5 months, heres what shocked me about the algorithm..."
   - "i just got fired from tiktok after 4 years, so now im spilling all the tea..."

Pattern breakdown - Authority Types:
   1. **Insider Access**: "visited TikTok HQ", "interned at TikTok" → behind-the-scenes credibility
   2. **Duration Proof**: "posting for 5 months", "4 years at TikTok" → earned wisdom through experience
   3. **Social Proof**: "copied creator with 1M followers" → reverse-engineering success
   4. **Betrayal/Drama**: "my toxic ex", "im exposing", "im spilling the tea" → forbidden knowledge angle
   5. **Whistleblower**: "i just got fired", "now im revealing" → nothing-to-lose transparency

Hook Structure Formula:
   [Authority/Credibility Source] + [Drama/Intrigue Element] + "heres what [learned/discovered/shocked me]..."

**⚠️ HOOK GOLDEN RULE: CREATE CURIOSITY, NEVER SATISFY IT ⚠️**

The hook's ONLY job is to make them swipe. It should PROMISE information, not DELIVER it.

**THE INFORMATION GAP PRINCIPLE:**
   Your hook must create an "itch" that can ONLY be scratched by swiping.
   - Set up WHAT you'll reveal, but NEVER reveal it
   - Tease the category of secrets, not the secrets themselves
   - The viewer should think "wait, what did they learn?" and NEED to swipe

**GOOD vs BAD HOOKS (Study These):**

   ❌ TOO MUCH INFO (spills the content):
   "i learned that drafts lose power and engagement matters more than you think..."
   → Problem: Already told them 2 insights. Why swipe?

   ❌ TOO VAGUE (no curiosity):
   "some tiktok tips..."
   → Problem: No authority, no intrigue, no promise

   ✅ PERFECT (promises without revealing):
   "i got invited to visit tiktoks headquarters, heres everything they revealed about the algorithm..."
   → Authority established, promise made, zero content revealed

   ✅ PERFECT:
   "ive been posting consistently for 5 months, heres what ive learned..."
   → Experience established, teases learnings, nothing given away

   ✅ PERFECT:
   "my toxic ex interned at tiktok for 5 months and now im exposing everything he told me..."
   → Drama + insider access + "exposing" = must swipe

   ✅ PERFECT:
   "common mistakes i see small creators make on tiktok..."
   → Implies list of mistakes, viewer thinks "am I making these?"

**HOOK STRUCTURE THAT WORKS:**
   [Authority/Experience] + "heres what ive [learned/discovered/found out]..."
   OR
   [Authority/Experience] + "now im [exposing/spilling/revealing] everything..."
   OR
   "[Topic] mistakes i see [audience] make..."

CRITICAL HOOK RULES:
   ❌ DO NOT reveal ANY actual insight in the hook (save ALL content for slide 2+)
   ❌ DO NOT list multiple things you learned (just promise you learned things)
   ❌ DO NOT use dramatic language ("truth bomb", "mind blown", "changed EVERYTHING", "totally")
   ❌ DO NOT be overly polished - use casual, lowercase, imperfect grammar ("heres" not "here's", "ive" not "I've", "im" not "I'm")
   ❌ DO NOT add unnecessary hype words or all caps for emphasis
   ❌ DO NOT use emojis in the hook (keep it raw and authentic)
   ❌ DO NOT start with the insight - start with the AUTHORITY
   ✅ DO establish credibility/authority FIRST (experience, access, experiment)
   ✅ DO end with a promise pattern ("heres what...", "now im exposing...", "this is what i found...")
   ✅ DO keep it conversational - like texting a friend, not writing marketing copy
   ✅ DO use lowercase "i" consistently (never "I")

The hook should feel like a friend about to share a forbidden secret, not a marketer making a pitch.
`

  // CTA examples for the model to learn from
  const ctaExamplesSection = productContext
    ? `
**CTA SLIDE EXAMPLES (Study These Patterns):**

Example 1 (67 words):
"you can test your videos BEFORE posting
there's this app called ${productContext.title} that literally mimics how tiktok ranks your video internally. it shows you your predicted retention, hook strength, and even what's dragging your views down. i test every video there before posting now... it's unreal how accurate it is"

Example 2 (57 words):
"easy to overthink your own content endlessly.

started using ${productContext.title} recently to analyze my videos before posting. gives you an outside perspective on what needs work. pretty helpful honestly"

Example 3 (54 words):
"they pay close attention to what works.

tools like ${productContext.title} help with that. they show what's holding people, what's not, and how to improve without the guesswork"

Example 4 (58 words):
"some apps can really do the heavy lifting for you.

used to be like 'why did this flop?' now i check my videos in ${productContext.title} before i post. it's like a lil algorithm bff that gives notes while i do my skincare 🫶"

Example 5 (62 words):
"you can literally predict your post performance now
there's this app called ${productContext.title} that mimics the internal testing system we used. it tells you your predicted retention, hook quality, even what's killing your reach. it's spooky accurate. literally tells you what to improve as well 🥺💗"

Example 6 (51 words):
"the hidden tool no one talks about
there's this app called ${productContext.title} that predicts how your videos will perform before you even post. it breaks down stuff like your retention curve, hook quality, and even gives you fixes. it's literally like having the algorithm whisper in your ear 🥺💖"

**CRITICAL CTA FORMULA (Second-to-Last Slide):**

**4-Part Rhythm Structure:**
1. **Transition/Hook** (3-8 words): Relatable problem or discovery moment
   Examples: "you can test your videos BEFORE posting", "easy to overthink your own content endlessly", "the hidden tool no one talks about", "they pay close attention to what works"

2. **Discovery Moment** (15-25 words): How you found the tool (casual, personal)
   Patterns: "there's this app called...", "started using... recently", "tools like... help with that", "i found this app..."

3. **Specific Benefits** (20-35 words): 2-3 concrete features WITHOUT marketing language
   Must mention: What it shows/predicts, how it helps, what you can fix
   Examples: "shows you your predicted retention, hook strength, and even what's dragging your views down"

4. **Authentic Marker** (5-12 words): Personal reaction that builds trust
   Examples: "pretty helpful honestly", "it's unreal how accurate it is", "it's spooky accurate", "ngl feels like cheating", "i swear it changed everything"

**LENGTH REQUIREMENT: 50-70 words total**

**AUTHENTICITY MARKERS - Must include 1-2:**
   - "honestly" → builds casual trust
   - "literally" → emphasizes truth
   - "ngl" (not gonna lie) → confessional tone
   - "i swear" → personal testimony
   - "pretty helpful" → understated recommendation (more believable)
   - "it's unreal/spooky/wild" → genuine amazement
   - "feels like cheating/algorithm whisper/bff" → playful metaphors

**LIFESTYLE INTEGRATION (Optional but powerful):**
   - "while i do my skincare" → weaves into daily routine
   - "before i post" → shows it's part of workflow
   - "sipping my coffee" → casual moment reference
   Makes the tool feel integrated into life, not an extra chore

**TONE RULES:**
   ✅ Use lowercase "i" consistently
   ✅ Drop apostrophes casually: "theres", "youre", "whats"
   ✅ Use ellipsis for pauses: "i test every video there before posting now..."
   ✅ Optional soft emojis at end ONLY: 🫶💗🥺💖 (if tone feels right)
   ❌ NO hard-sell language: "you should try", "must have", "game changer"
   ❌ NO marketing speak: "revolutionary", "amazing", "incredible"
   ❌ Frame as YOUR discovery, not a recommendation to them
`
    : ''

  // Content slide patterns and rules
  const contentSlideSection = `
**CONTENT SLIDE FORMULA (Micro-Dopamine Engineering):**

**Proven Slide Openers (Use These Patterns):**
   - "the #1 mistake that kills growth" → creates urgency
   - "the [concept] is REAL" → validates viewer's suspicion
   - "you don't need [X], you need [Y]" → reframes belief
   - "wild fact:" / "this one shocked me" → promises surprise
   - "easy to overthink..." → shows empathy
   - "your [thing] affects your [result] too" → reveals hidden connection
   - "dry spells are intentional" → reframes frustration
   - "the algorithm watches how YOU behave too" → personalizes system
   - "why your [metric] tanks randomly" → answers burning question
   - "old videos aren't dead. they're 'sleeping'" → metaphor hook

**3-Part Slide Structure (CRITICAL):**
Every content slide must follow this exact pattern:

1. **Bold Statement** (5-12 words): The insight/claim
   Example: "videos left in your drafts lose power"

2. **Why It Matters** (15-30 words): Explanation with specifics
   Example: "the system timestamps your draft when you create it, not when you post. the longer it sits, the more it's seen as outdated"

3. **Personal Reaction/Proof** (3-8 words): Authentic marker that builds trust
   Example: "this one shocked me", "girl when i found this out i screamed", "i swear this one's the most gatekept"

**INSIDER LANGUAGE - Make It Feel Like Leaked Info:**
Use these patterns to sound like you're sharing internal knowledge:
   - "we tracked this" → implies you worked at TikTok
   - "we called it [term]" → reveals internal jargon (e.g., "clustering", "identity score", "resets")
   - "behind the scenes" → suggests privileged access
   - "internal docs literally showed us..." → concrete proof claim
   - "this is my least favorite part" → insider opinion
   - "the system uses them to 'map'..." → explains algorithm as if you built it
   - "they call it [term]" → references TikTok employees

**ALGORITHM ANTHROPOMORPHIZATION - Make It Feel Human:**
CRITICAL: The algorithm should feel like a sentient entity, not code
   - "the system gets 'confused'" → gives it mental states
   - "tiktok takes notes" → makes it observant
   - "the algorithm notices" → gives it awareness
   - "it flags you as indecisive" → gives it judgment
   - "the system stopped 'trusting' you" → emotional relationship
   - "tiktok pairs your content" → intelligent matchmaking
   - "it's like the app says 'oh, they're part of the same circle'" → internal dialogue
   - "the algorithm sees you as less invested" → perception
   - "it labels your account 'unstable'" → categorization with personality
   - "the algorithm whispers" → secret communication

**AUTHENTICITY MARKERS - Sprinkle Throughout Content:**
Must include 1-2 per slide to maintain conversational trust:
   - "this one shocked me" → personal surprise
   - "girl when i found this out i screamed" → relatable reaction
   - "i swear" → testimony emphasis
   - "this is my least favorite part" → honest opinion
   - "literally" → emphasizes truth (use frequently)
   - "seriously" → draws attention
   - "honestly" → builds trust
   - "ngl" (not gonna lie) → confessional
   - Use emojis ONLY at end of slides, never mid-sentence: ✨💖🎀🌸🥺💗🫶

**CASUAL GRAMMAR RULES (MANDATORY):**
Must follow these patterns for authenticity:
   ✅ Always lowercase "i" (never "I")
   ✅ Drop apostrophes: "heres" not "here's", "ive" not "I've", "dont" not "don't", "youre" not "you're", "thats" not "that's", "cant" not "can't", "whats" not "what's"
   ✅ Use ellipsis for dramatic pauses: "don't. do. it." or "i test every video there before posting now..."
   ✅ Incomplete sentences are good: "girl be loyal"
   ✅ Run-on thoughts: "messy drafts = messy data"
   ✅ Casual intensifiers: "literally", "seriously", "way more", "so much"
   ❌ NO perfect grammar - it kills authenticity
   ❌ NO capitalization except for emphasis (rare)
   ❌ NO formal punctuation (keep it flowing)

**EMOTIONAL SPIKE SEQUENCING:**
Content slides should create an emotional journey:
   - Slide 2: **Shock/Surprise** ("this one shocked me", reveal counterintuitive truth)
   - Slide 3: **Validation/Relief** ("you're not shadowbanned", reframe their fear)
   - Slide 4: **Empowerment** ("you don't need a niche", permission to be themselves)
   - Slide 5 (if needed): **Hope/Possibility** (show what's possible, set up CTA)

This oscillation keeps viewers engaged and emotionally invested.

**ONE IDEA PER SLIDE RULE:**
   ✅ Each slide = ONE single, clear insight
   ✅ Don't clutter with multiple concepts
   ✅ Let each slide breathe - it should feel like a revelation
   ❌ Don't combine multiple tips into one slide
`

  const prompt = `You are a TikTok carousel content creator. Analyze the reference posts below and generate ${variationCount} variations of carousel content.

${postsContext}
${productSection}
**Language Style:**
${languageStyle}
${contentIdeasSection}
${conceptsSection}
**Generation Strategy:**
${strategyDescription}
${hookExamplesSection}
${contentSlideSection}
${ctaExamplesSection}

**CRITICAL REQUIREMENTS:**

1. EXACT Slide Structure (no exceptions):
   - Exactly ONE HOOK slide (must be the first slide)
   - 3-4 CONTENT slides (use emotional spike sequencing from CONTENT SLIDE FORMULA)
   - Exactly ONE CTA slide (MUST be second-to-last slide)${productContext ? ' - use the 4-Part Rhythm Structure from CTA examples above' : ''}
   - Exactly ONE FINAL CONCLUSION slide (last slide - wraps up the journey)
   - **OPTIMAL TOTAL: 6 slides** (hook + 3 content + cta + conclusion) - this is the proven viral formula
${productContext ? `
   **PRODUCT MENTION RULE (CRITICAL - DO NOT VIOLATE):**
   ❌ NEVER mention "${productContext.title}" or any product/tool/app on HOOK slides
   ❌ NEVER mention "${productContext.title}" or any product/tool/app on CONTENT slides
   ❌ NEVER mention "${productContext.title}" or any product/tool/app on CONCLUSION slides
   ✅ ONLY mention "${productContext.title}" on the CTA slide (second-to-last)

   The hook, content, and conclusion slides must feel like pure value sharing - no selling, no product hints.
   Only the CTA slide introduces the product as a natural personal discovery.
   This maintains authenticity and prevents the content from feeling like an advertisement.
` : ''}
2. Open Loop Psychology - CRITICAL FOR VIRALITY:
   - Each slide MUST create an open loop (information gap) that hooks the viewer to swipe to the next slide
   - Viewers must feel compelled to close this info gap by swiping
   - Every slide should act as a mini-hook for the next slide, creating continuous engagement
   - Use techniques like: incomplete thoughts, teasing next information, raising questions, building curiosity
   - This open loop pattern repeats throughout the entire carousel to maximize retention

3. Viral Slideshow Format Selection (MUST pick ONE and categorize in metadata):
   - **Insider Secrets** (most viral): Leaked TikTok knowledge, algorithm insights, behind-the-scenes info
   - **Listicles**: Numbered mistakes/secrets that build anticipation
   - **Problem-Solution Storyline**: Present relatable creator frustrations, then reveal solutions
   - **Educational Deep-Dive**: Teach complex algorithm concepts step-by-step
   - **Day in the Life**: Personal creator journey with progressive revelations
   - Choose the format that best fits the source posts and content strategy

4. Content Flow & Emotional Arc:

   **HOOK (Slide 1):**
   - Follow HOOK SLIDE FORMULA exactly - use one of the 5 authority types
   - Create maximum information gap - DO NOT reveal the actual insight
   - End with "heres what ive learned/discovered/shocked me" pattern
   - Use lowercase, drop apostrophes, keep it raw (no emojis)${productContext ? '\n   - ❌ NO PRODUCT MENTIONS - hook is pure intrigue, no selling' : ''}

   **CONTENT SLIDES (Slides 2-4/5):**
   - Follow the 3-Part Slide Structure: Bold Statement → Why It Matters → Personal Reaction
   - Use Proven Slide Openers from CONTENT SLIDE FORMULA
   - Apply Emotional Spike Sequencing:
     • Slide 2: Shock/Surprise (counterintuitive revelation)
     • Slide 3: Validation/Relief (reframe their fear)
     • Slide 4: Empowerment (permission/possibility)
   - Use Algorithm Anthropomorphization - make the system feel sentient
   - Include Insider Language - sound like you worked at TikTok
   - Sprinkle Authenticity Markers (1-2 per slide)
   - Follow Casual Grammar Rules religiously
   - ONE idea per slide - let each breathe${productContext ? '\n   - ❌ NO PRODUCT MENTIONS - content slides are pure value, no selling' : ''}

   **CTA SLIDE (Second-to-Last):**${productContext ? '\n   - Follow the 4-Part Rhythm Structure exactly (50-70 words)\n   - Transition → Discovery Moment → Specific Benefits → Authentic Marker\n   - Frame as YOUR discovery ("i use", "i found", "started using")\n   - Include 2-3 concrete features without marketing language\n   - Optional: Lifestyle Integration ("while i do my skincare")\n   - Must include Authenticity Markers ("honestly", "literally", "ngl")\n   - Use casual grammar (lowercase "i", dropped apostrophes)\n   - Optional soft emojis at end only: 🫶💗🥺💖' : '\n   - Adapt naturally from reference posts\' CTA style\n   - Keep conversational and authentic'}

   **FINAL SLIDE (Last):**
   - Provide satisfying closure to the journey
   - Can be a bonus tip, summary insight, or encouraging message
   - Maintains the same casual, authentic voice
   - Creates sense of completion (viewer feels satisfied they stayed till the end)${productContext ? '\n   - ❌ NO PRODUCT MENTIONS - conclusion is pure value wrap-up, no selling' : ''}

5. Slide Count Strategy:
   - Generate exactly ${variationCount} variations${referenceStructure ? `
   - **EXACT STRUCTURE REQUIRED - FOLLOW THIS SLIDE SEQUENCE PRECISELY**:
     - Total slides: ${referenceStructure.slideCount}
     - **EXACT SLIDE ORDER (MUST FOLLOW THIS SEQUENCE)**:
${referenceStructure.slideClassifications
  .sort((a, b) => a.slideIndex - b.slideIndex)
  .map(s => `       • Slide ${s.slideIndex + 1}: ${s.slideType.toUpperCase()}`)
  .join('\n')}
     - DO NOT rearrange the slide types. The sequence above is MANDATORY.
     - Each variation must have slides in exactly this order.
   - Match this structure precisely for each variation` : `
   - **TARGET: 6 slides per variation** (this is the proven viral sweet spot)
   - Acceptable range: ${slidesRange.min}-${slidesRange.max} slides
   - Structure: 1 hook + 3-4 content + 1 CTA + 1 conclusion`}

6. Language & Style - AUTHENTICITY IS EVERYTHING:
   - Follow the specified language style: ${languageStyle}
   - But ALWAYS prioritize the Casual Grammar Rules from CONTENT SLIDE FORMULA
   - Write like texting a friend, NOT creating content
   - Every slide should sound like the same real person (consistent voice)
   - Use Authenticity Markers throughout to build trust
   - Study reference posts' tone - replicate that exact casual energy
   - Imperfection = authenticity = trust = engagement

7. Variation Metadata:
   - Create a cohesive "description" field that paraphrases ALL slides as one flowing story
   - This should read like a natural paragraph capturing the entire carousel journey
   - Flow from hook → content insights → CTA → conclusion as one narrative
   - Maintain the same casual, authentic tone
   - This is the story TOLD by the carousel, not a description ABOUT the carousel

8. **⚠️ VARIATION DIVERSITY REQUIREMENT (CRITICAL) ⚠️**

   Each of the ${variationCount} variations MUST be distinctly different. Do NOT generate similar variations.

   **MANDATORY DIVERSITY RULES:**

   A. **HOOK DIVERSITY** - Each variation MUST use a DIFFERENT authority type:
      - Variation 1: Use authority type A (e.g., "visited headquarters")
      - Variation 2: Use authority type B (e.g., "posting for X months")
      - Variation 3: Use authority type C (e.g., "copied a 1M creator")
      - And so on... NO TWO VARIATIONS can use the same hook angle

   B. **CONTENT ANGLE DIVERSITY** - Each variation should approach the insights differently:
      - Same concept, different metaphor/example
      - Same insight, different framing (positive vs cautionary)
      - Reorder which insights appear in which slides

   C. **CTA OPENER DIVERSITY** - Each variation MUST have a unique CTA opener:
      - ❌ BAD: All variations start CTA with "you can test your videos"
      - ✅ GOOD: Var 1: "easy to overthink...", Var 2: "the hidden tool...", Var 3: "some apps can really..."

   **SELF-CHECK BEFORE OUTPUT:**
   Before returning, verify:
   - "Are all my hooks using different authority angles?" → If not, rewrite
   - "Would a reader think these are copy-pastes of each other?" → If yes, differentiate
   - "Is each variation offering a fresh perspective?" → If not, rework

Return the structured JSON response following the schema.`

  return prompt
}

export async function generateContent(config: GenerationConfig): Promise<GenerationResult> {
  try {
    console.log(`🚀 [ContentGen] Starting content generation with ${config.variationCount} variations`)

    // Initialize Gemini AI
    if (!process.env.GEMINI_API_KEY) {
      const error = new Error('GEMINI_API_KEY environment variable is required')
      Sentry.captureException(error, {
        tags: { operation: 'content_generation' }
      })
      throw error
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    // Build the prompt
    const prompt = buildPrompt(config)

    console.log(`🤖 [ContentGen] Calling Gemini with structured output...`)

    // Call Gemini with structured output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user' as const,
        parts: [{ text: prompt }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: CONTENT_GENERATION_SCHEMA,
      },
    })

    if (!response.text) {
      const error = new Error('No response from Gemini AI')
      Sentry.captureException(error, {
        tags: { operation: 'content_generation' },
        extra: { response }
      })
      throw error
    }

    console.log(`✅ [ContentGen] Received structured response from Gemini`)

    // Parse the structured response
    const generationResult: GenerationResult = JSON.parse(response.text)

    console.log(`📊 [ContentGen] Generated:`, {
      totalVariations: generationResult.generationMetadata.totalVariations,
      strategy: generationResult.generationMetadata.strategy,
      variationsCount: generationResult.variations.length
    })

    return generationResult

  } catch (error) {
    console.error(`❌ [ContentGen] Failed to generate content:`, error)

    // Report to Sentry
    Sentry.captureException(error, {
      tags: { operation: 'content_generation' },
      extra: { config }
    })

    throw error instanceof Error ? error : new Error('Content generation failed')
  }
}
