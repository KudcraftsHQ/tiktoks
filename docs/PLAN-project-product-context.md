# Implementation Plan: Project-Level Product Context & Enhanced Coherence Fixing

## Overview
This plan implements two major features:
1. Project-level product context selection with UI dropdown
2. Enhanced coherence fixing that validates CTA slides against product context

## Feature 1: Project-Level Product Context

### Goal
Allow users to select a ProductContext at the project level, which will be used automatically when generating drafts for that project.

### Database Changes

#### 1.1 Update Prisma Schema
**File**: `prisma/schema.prisma`

Add `productContextId` field to `Project` model:

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // NEW: Product context relationship
  productContextId String?
  productContext   ProductContext? @relation(fields: [productContextId], references: [id], onDelete: SetNull)

  posts    ProjectPost[]
  remixes  RemixPost[]

  @@map("projects")
  @@index([productContextId])
}
```

Also update `ProductContext` model to include the inverse relation:

```prisma
model ProductContext {
  id          String   @id @default(cuid())
  title       String
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  remixes       RemixPost[]
  draftSessions DraftSession[]
  projects      Project[]  // NEW: Inverse relation

  @@map("product_contexts")
  @@index([title])
}
```

**Migration Steps**:
1. Run `bun prisma migrate dev --name add_product_context_to_project`
2. Run `bun prisma generate` to update Prisma client

### API Changes

#### 1.2 Update Project GET Endpoint
**File**: `src/app/api/projects/[id]/route.ts`

Update the project query to include `productContext`:

```typescript
const project = await prisma.project.findUnique({
  where: { id: params.id },
  include: {
    productContext: true,  // NEW: Include product context
    posts: {
      include: {
        post: {
          include: {
            // ... existing includes
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    },
    remixes: {
      include: {
        // ... existing includes
      },
      orderBy: { createdAt: 'desc' }
    }
  }
})
```

#### 1.3 Create Project Update Endpoint
**File**: `src/app/api/projects/[id]/route.ts`

Add PATCH handler to update product context:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { productContextId } = body

    // Validate productContextId if provided
    if (productContextId) {
      const contextExists = await prisma.productContext.findUnique({
        where: { id: productContextId }
      })

      if (!contextExists) {
        return NextResponse.json(
          { error: 'Product context not found' },
          { status: 404 }
        )
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        productContextId: productContextId || null
      },
      include: {
        productContext: true
      }
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}
```

#### 1.4 Create Product Contexts List Endpoint
**File**: `src/app/api/product-contexts/route.ts`

This already exists, but ensure GET endpoint returns all product contexts:

```typescript
export async function GET() {
  try {
    const productContexts = await prisma.productContext.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(productContexts)
  } catch (error) {
    console.error('Error fetching product contexts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product contexts' },
      { status: 500 }
    )
  }
}
```

### UI Changes

#### 1.5 Update Project Page Header
**File**: `src/app/(desktop)/projects/[id]/page.tsx`

**Current State** (line 752):
```typescript
<PageLayout
  title={
    isEditingTitle ? (
      <Input value={editedTitle} onChange={...} />
    ) : (
      <span className="text-lg font-semibold">{project.name}</span>
    )
  }
  actions={<Button>Generate Drafts</Button>}
>
```

**New State**:
```typescript
<PageLayout
  title={
    <div className="flex items-center gap-3">
      {/* Project Title */}
      {isEditingTitle ? (
        <Input value={editedTitle} onChange={...} />
      ) : (
        <span className="text-lg font-semibold">{project.name}</span>
      )}

      {/* Product Context Dropdown */}
      <ProductContextSelector
        value={project.productContextId || ''}
        onChange={handleProductContextChange}
      />
    </div>
  }
  actions={<Button>Generate Drafts</Button>}
>
```

#### 1.6 Create ProductContextSelector Component
**File**: `src/components/ProductContextSelector.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProductContext } from '@/types/remix'

interface ProductContextSelectorProps {
  value: string
  onChange: (productContextId: string | null) => void
}

export function ProductContextSelector({
  value,
  onChange
}: ProductContextSelectorProps) {
  const [productContexts, setProductContexts] = useState<ProductContext[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProductContexts() {
      try {
        const response = await fetch('/api/product-contexts')
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setProductContexts(data)
      } catch (error) {
        console.error('Error fetching product contexts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProductContexts()
  }, [])

  if (isLoading) {
    return (
      <div className="w-[200px] h-9 bg-muted animate-pulse rounded-md" />
    )
  }

  return (
    <Select
      value={value || 'none'}
      onValueChange={(val) => onChange(val === 'none' ? null : val)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select product..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No Product</SelectItem>
        {productContexts.map((pc) => (
          <SelectItem key={pc.id} value={pc.id}>
            {pc.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

#### 1.7 Add Product Context Update Handler
**File**: `src/app/(desktop)/projects/[id]/page.tsx`

Add state and handler:

```typescript
const [selectedProductContextId, setSelectedProductContextId] = useState<string | null>(
  project.productContextId || null
)

const handleProductContextChange = async (productContextId: string | null) => {
  try {
    const response = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productContextId })
    })

    if (!response.ok) throw new Error('Failed to update')

    const updated = await response.json()
    setSelectedProductContextId(updated.productContextId)

    // Optimistic update
    setProject((prev) => ({
      ...prev,
      productContextId: updated.productContextId,
      productContext: updated.productContext
    }))

    toast.success('Product context updated')
  } catch (error) {
    console.error('Error updating product context:', error)
    toast.error('Failed to update product context')
  }
}
```

### Generation Flow Changes

#### 1.8 Update Generate Drafts Button
**File**: `src/app/(desktop)/projects/[id]/page.tsx`

When opening GenerateContentDrawer, pass project's product context:

```typescript
<GenerateContentDrawer
  projectId={project.id}
  selectedPosts={project.posts}
  defaultProductContext={project.productContext}  // NEW: Pass project-level context
  onSuccess={handleDraftsGenerated}
/>
```

#### 1.9 Update GenerateContentDrawer
**File**: `src/components/GenerateContentDrawer.tsx`

Add default product context prop and auto-selection logic:

```typescript
interface GenerateContentDrawerProps {
  projectId: string
  selectedPosts: ProjectPost[]
  defaultProductContext?: ProductContext | null  // NEW
  onSuccess: () => void
}

export function GenerateContentDrawer({
  projectId,
  selectedPosts,
  defaultProductContext,  // NEW
  onSuccess
}: GenerateContentDrawerProps) {
  const [productContexts, setProductContexts] = useState<ProductContext[]>([])
  const [selectedProductContextId, setSelectedProductContextId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProductContexts() {
      const response = await fetch('/api/product-contexts')
      const data = await response.json()
      setProductContexts(data)

      // Auto-selection logic
      if (defaultProductContext) {
        // Use project-level product context if set
        setSelectedProductContextId(defaultProductContext.id)
      } else if (data.length === 1) {
        // Auto-select if only one product context exists
        setSelectedProductContextId(data[0].id)
      }
    }

    fetchProductContexts()
  }, [defaultProductContext])

  // ... rest of component
}
```

## Feature 2: Enhanced Coherence Fixing for CTA Slides

### Goal
Update the coherence fixing system to validate CTA slides against the project's product context, ensuring product mentions are correct and consistent.

### Analysis Service Changes

#### 2.1 Update Coherence Analysis Service
**File**: `src/lib/coherence-analysis-service.ts`

Add product context validation for CTA slides:

```typescript
export interface CoherenceIssue {
  slideIndex: number
  issueType: 'pov_inconsistency' | 'voice_mismatch' | 'tone_jump' | 'product_mismatch'  // NEW type
  severity: 'high' | 'medium' | 'low'
  description: string
  currentValue?: string
  suggestedValue?: string
}

export async function analyzeCoherence(
  slides: RemixSlide[],
  classifications: SlideClassification[],
  productContext?: { title: string; description: string }  // NEW parameter
): Promise<{ issues: CoherenceIssue[]; affectedSlideCount: number }> {
  // Existing POV/voice/tone analysis...

  // NEW: CTA product context validation
  if (productContext) {
    const ctaIssues = await analyzeCTAProductContext(
      slides,
      classifications,
      productContext
    )
    issues.push(...ctaIssues)
  }

  return {
    issues,
    affectedSlideCount: new Set(issues.map(i => i.slideIndex)).size
  }
}

async function analyzeCTAProductContext(
  slides: RemixSlide[],
  classifications: SlideClassification[],
  productContext: { title: string; description: string }
): Promise<CoherenceIssue[]> {
  const issues: CoherenceIssue[] = []

  // Find CTA slides
  const ctaSlides = classifications
    .filter(c => c.type === 'cta')
    .map(c => ({ index: c.slideIndex, slide: slides[c.slideIndex] }))

  for (const { index, slide } of ctaSlides) {
    const text = slide.paraphrasedText.toLowerCase()

    // Check if CTA mentions a product
    const productMentionPatterns = [
      /there'?s? this (?:app|tool|website) called ([^.!?\n]+)/i,
      /(?:app|tool|website) called ([^.!?\n]+)/i,
      /check out ([^.!?\n]+)/i,
      /try ([^.!?\n]+)/i,
    ]

    let mentionedProduct: string | null = null
    for (const pattern of productMentionPatterns) {
      const match = text.match(pattern)
      if (match) {
        mentionedProduct = match[1].trim()
        break
      }
    }

    // Validate against expected product
    if (mentionedProduct) {
      const expectedProduct = productContext.title.toLowerCase()
      const actualProduct = mentionedProduct.toLowerCase()

      if (actualProduct !== expectedProduct) {
        issues.push({
          slideIndex: index,
          issueType: 'product_mismatch',
          severity: 'high',
          description: `CTA mentions "${mentionedProduct}" but project uses "${productContext.title}"`,
          currentValue: mentionedProduct,
          suggestedValue: productContext.title
        })
      }
    } else {
      // CTA should mention the product if product context exists
      issues.push({
        slideIndex: index,
        issueType: 'product_mismatch',
        severity: 'medium',
        description: `CTA slide should mention product "${productContext.title}"`,
        suggestedValue: productContext.title
      })
    }
  }

  return issues
}
```

### Fixing Service Changes

#### 2.2 Update Coherence Fixing Service
**File**: `src/lib/coherence-fixing-service.ts`

Add product replacement logic:

```typescript
export async function generateCoherenceFixes(
  slides: RemixSlide[],
  classifications: SlideClassification[],
  issues: CoherenceIssue[],
  productContext?: { title: string; description: string }  // NEW parameter
): Promise<FixedSlide[]> {
  const fixedSlides: FixedSlide[] = []

  // Group issues by slide
  const issuesBySlide = new Map<number, CoherenceIssue[]>()
  for (const issue of issues) {
    if (!issuesBySlide.has(issue.slideIndex)) {
      issuesBySlide.set(issue.slideIndex, [])
    }
    issuesBySlide.get(issue.slideIndex)!.push(issue)
  }

  // Process each slide with issues
  for (const [slideIndex, slideIssues] of issuesBySlide) {
    const slide = slides[slideIndex]
    const classification = classifications.find(c => c.slideIndex === slideIndex)

    // Check if this is a CTA slide with product issues
    const hasProductIssues = slideIssues.some(i => i.issueType === 'product_mismatch')

    if (hasProductIssues && classification?.type === 'cta' && productContext) {
      // Handle product replacement separately
      const fixed = await fixCTAProductMismatch(
        slide,
        slideIssues,
        productContext
      )
      fixedSlides.push({
        slideIndex,
        originalText: slide.paraphrasedText,
        fixedText: fixed,
        issuesFixed: slideIssues.filter(i => i.issueType === 'product_mismatch')
      })
    } else {
      // Existing POV/voice/tone fixing logic
      const fixed = await fixSlideIssues(slide, slideIssues)
      fixedSlides.push({
        slideIndex,
        originalText: slide.paraphrasedText,
        fixedText: fixed,
        issuesFixed: slideIssues
      })
    }
  }

  return fixedSlides
}

async function fixCTAProductMismatch(
  slide: RemixSlide,
  issues: CoherenceIssue[],
  productContext: { title: string; description: string }
): Promise<string> {
  let fixedText = slide.paraphrasedText

  // Find product mentions and replace
  const productIssue = issues.find(i => i.issueType === 'product_mismatch')
  if (!productIssue) return fixedText

  // Replace patterns
  const patterns = [
    {
      regex: /(there'?s? this (?:app|tool|website) called )[^.!?\n]+/gi,
      replacement: `$1${productContext.title}`
    },
    {
      regex: /((?:app|tool|website) called )[^.!?\n]+/gi,
      replacement: `$1${productContext.title}`
    },
    {
      regex: /(check out )[^.!?\n]+/gi,
      replacement: `$1${productContext.title}`
    },
    {
      regex: /(try )[^.!?\n]+/gi,
      replacement: `$1${productContext.title}`
    }
  ]

  for (const { regex, replacement } of patterns) {
    fixedText = fixedText.replace(regex, replacement)
  }

  // If no product mention found but should have one, use AI to insert naturally
  if (fixedText === slide.paraphrasedText && productIssue.currentValue === undefined) {
    fixedText = await insertProductMentionWithAI(fixedText, productContext)
  }

  return fixedText
}

async function insertProductMentionWithAI(
  text: string,
  productContext: { title: string; description: string }
): Promise<string> {
  // Use Gemini to naturally insert product mention
  const prompt = `You are fixing a CTA (call-to-action) slide that is missing a product mention.

Current slide text:
"""
${text}
"""

Product to mention:
Name: ${productContext.title}
Description: ${productContext.description}

Instructions:
1. Add a natural mention of "${productContext.title}" to this CTA slide
2. Use conversational language: "there's this app called ${productContext.title}..."
3. Keep the original style and tone
4. Make MINIMAL changes - only add the product mention
5. Follow the 4-part CTA rhythm: hook → discovery → benefits → authentic marker

Return ONLY the fixed text, no explanations.`

  // Call Gemini API
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}
```

### API Endpoint Changes

#### 2.3 Update Analyze Coherence Endpoint
**File**: `src/app/api/remixes/[id]/analyze-coherence/route.ts`

Pass product context to analysis:

```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const draft = await prisma.remixPost.findUnique({
      where: { id: params.id },
      include: {
        productContext: true,  // NEW: Include product context
        project: {             // NEW: Include project's product context
          include: {
            productContext: true
          }
        }
      }
    })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // Determine which product context to use
    const productContext =
      draft.productContext ||           // Draft-level context (higher priority)
      draft.project?.productContext ||  // Project-level context
      null

    const slides = draft.slides as RemixSlide[]
    const classifications = draft.slideClassifications as SlideClassification[]

    const analysis = await analyzeCoherence(
      slides,
      classifications,
      productContext  // NEW: Pass product context
    )

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error analyzing coherence:', error)
    return NextResponse.json(
      { error: 'Failed to analyze coherence' },
      { status: 500 }
    )
  }
}
```

#### 2.4 Update Preview Coherence Fix Endpoint
**File**: `src/app/api/remixes/[id]/preview-coherence-fix/route.ts`

Pass product context to fixing service:

```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const draft = await prisma.remixPost.findUnique({
      where: { id: params.id },
      include: {
        productContext: true,
        project: {
          include: {
            productContext: true
          }
        }
      }
    })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const productContext =
      draft.productContext ||
      draft.project?.productContext ||
      null

    const slides = draft.slides as RemixSlide[]
    const classifications = draft.slideClassifications as SlideClassification[]

    // Re-run analysis to get current issues
    const { issues } = await analyzeCoherence(
      slides,
      classifications,
      productContext
    )

    // Generate fixes
    const fixes = await generateCoherenceFixes(
      slides,
      classifications,
      issues,
      productContext  // NEW: Pass product context
    )

    // Format response...
    return NextResponse.json({ beforeAfter, allSlides })
  } catch (error) {
    console.error('Error previewing coherence fix:', error)
    return NextResponse.json(
      { error: 'Failed to preview fixes' },
      { status: 500 }
    )
  }
}
```

### UI Changes

#### 2.5 Update FixCoherenceDialog Component
**File**: `src/components/FixCoherenceDialog.tsx`

Add product mismatch issue display:

```typescript
function getIssueBadgeColor(issueType: string): string {
  switch (issueType) {
    case 'pov_inconsistency':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'voice_mismatch':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    case 'tone_jump':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'product_mismatch':  // NEW
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

function formatIssueType(issueType: string): string {
  switch (issueType) {
    case 'pov_inconsistency':
      return 'POV Inconsistency'
    case 'voice_mismatch':
      return 'Voice Mismatch'
    case 'tone_jump':
      return 'Tone Jump'
    case 'product_mismatch':  // NEW
      return 'Product Mismatch'
    default:
      return issueType
  }
}
```

## Implementation Order

### Phase 1: Database & API (Priority: High)
1. Update Prisma schema with `productContextId` on Project model
2. Run migration: `bun prisma migrate dev --name add_product_context_to_project`
3. Run `bun prisma generate`
4. Update `GET /api/projects/[id]` to include productContext
5. Add `PATCH /api/projects/[id]` endpoint
6. Verify `GET /api/product-contexts` endpoint

### Phase 2: UI Components (Priority: High)
1. Create `ProductContextSelector.tsx` component
2. Update project page header layout
3. Add product context change handler
4. Update `GenerateContentDrawer` with auto-selection logic

### Phase 3: Coherence Analysis (Priority: Medium)
1. Update `analyzeCoherence()` function signature
2. Add `analyzeCTAProductContext()` function
3. Add `product_mismatch` issue type
4. Update API endpoints to pass product context

### Phase 4: Coherence Fixing (Priority: Medium)
1. Update `generateCoherenceFixes()` function signature
2. Add `fixCTAProductMismatch()` function
3. Add `insertProductMentionWithAI()` helper
4. Update preview/apply endpoints

### Phase 5: UI Polish (Priority: Low)
1. Update `FixCoherenceDialog` with product mismatch styling
2. Add loading states
3. Add error handling
4. Test auto-selection flows

## Testing Checklist

### Feature 1: Product Context Selection
- [ ] Product context dropdown appears in project header
- [ ] Dropdown loads all available product contexts
- [ ] Selecting a product context updates the project
- [ ] "No Product" option clears the product context
- [ ] Auto-selection works when only one product context exists
- [ ] Project-level context is used when generating drafts
- [ ] Loading states display correctly
- [ ] Error handling works for failed updates

### Feature 2: CTA Coherence Fixing
- [ ] Analysis detects wrong product name in CTA
- [ ] Analysis detects missing product mention in CTA
- [ ] Fix preview shows product name replacement
- [ ] Fix preview shows product insertion when missing
- [ ] Apply changes updates CTA slides correctly
- [ ] Product mismatch issues display with correct styling
- [ ] Draft-level product context takes priority over project-level
- [ ] AI insertion maintains CTA style and tone

## Rollback Plan

If issues arise, rollback in reverse order:
1. Revert UI changes (no database impact)
2. Revert API endpoint changes
3. Revert coherence service changes
4. Revert Prisma migration: `bun prisma migrate reset` (WARNING: loses data)

## Notes

### Auto-Selection Logic Priority
1. Project-level product context (if set)
2. Single product context in database (if only one exists)
3. No selection (user must choose)

### Product Context Hierarchy
When fixing coherence:
1. Draft-level `productContext` (highest priority)
2. Project-level `productContext` (fallback)
3. No product context (skip CTA validation)

### CTA Replacement Strategy
1. **Simple replacement**: Use regex for known patterns
2. **AI insertion**: Use Gemini if product mention missing entirely
3. **Minimal changes**: Preserve original style and tone

### Performance Considerations
- Product context dropdown: Client-side caching (already fetched once)
- Coherence analysis: Add product validation only if product context exists
- Database queries: Use existing includes, minimal extra queries
