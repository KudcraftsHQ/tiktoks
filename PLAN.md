# Concept Selector for Empty Draft Slides - Implementation Plan

## Overview
Add a concept/example selector button to empty draft slides that allows users to:
1. Select a concept and example for each slide
2. Auto-fill remaining slides when selecting HOOK
3. Cycle through examples by clicking repeatedly
4. Use Fix Coherence afterward to smooth the flow

## Current State
- `InlineEditableText` shows placeholder when empty
- `ConceptSelectorPopover` exists for selecting concepts/examples
- Concept types (HOOK, CONTENT, CTA) map 1:1 to slide types
- Examples are applied via `/api/remixes/{id}/slides/{index}/apply-example`

## Implementation Steps

### Step 1: Modify InlineEditableText for Empty State Button
**File**: `src/components/InlineEditableText.tsx`

Add new optional props:
```typescript
interface InlineEditableTextProps {
  // ... existing props
  showEmptyStateButton?: boolean
  emptyStateButtonContent?: React.ReactNode
  onEmptyStateButtonClick?: () => void
}
```

When `value` is empty and `showEmptyStateButton` is true:
- Show a centered button with the provided content
- Clicking triggers `onEmptyStateButtonClick`
- Button should have a subtle "Add content" appearance (Lightbulb + "Select Example")

### Step 2: Create New ConceptQuickSelector Component
**File**: `src/components/ConceptQuickSelector.tsx`

A simpler, streamlined version of ConceptSelectorPopover for empty slides:
- Fetches concepts by slideType
- Shows concepts with example count
- Click concept → expand examples
- Click example → immediately apply (copy mode by default)
- Track "current example index" per slide to enable cycling
- Button shows "Next Example" after first selection

### Step 3: Add Auto-fill Feature for HOOK Selection
When user selects a HOOK example:
1. Apply to slide 0 (HOOK)
2. For each remaining CONTENT slide (indices 1 to n-2):
   - Pick a random CONTENT concept
   - Pick a random example from that concept
   - Apply to the slide
3. For the last slide (CTA):
   - Pick a random CTA concept
   - Pick a random example from that concept
   - Apply to the slide
4. Show toast: "Auto-filled X slides with concept examples"

### Step 4: Implement Example Cycling
Store state per slide:
```typescript
interface SlideConceptState {
  conceptId: string
  exampleIds: string[]      // All example IDs in this concept
  currentExampleIndex: number
}
```

When user clicks "Next Example":
1. Increment `currentExampleIndex` (wrap to 0 if at end)
2. Apply the next example from the same concept
3. Update slide text optimistically

### Step 5: Update ProjectPostsTable
**File**: `src/components/ProjectPostsTable.tsx`

In the SortableSlide component:
1. Check if slide text is empty or very short
2. If empty, render `InlineEditableText` with empty state button enabled
3. Wire up the button to open ConceptQuickSelector
4. Pass callback for auto-fill when HOOK is selected

### Step 6: API Updates (if needed)
**File**: `src/app/api/remixes/[id]/auto-fill-concepts/route.ts` (new)

POST endpoint that:
1. Takes draftId
2. Fetches all concepts grouped by type
3. For each classified slide without content:
   - Pick random concept of matching type
   - Pick random example
   - Apply to slide
4. Return all applied changes

## UI/UX Flow

### Empty Slide State
```
┌─────────────────────────────────────┐
│  Slide 1 │ Hook │ No concept        │
├─────────────────────────────────────┤
│                                     │
│      ┌─────────────────────┐        │
│      │ 💡 Select Example   │        │
│      └─────────────────────┘        │
│                                     │
└─────────────────────────────────────┘
```

### After First Selection (with cycling)
```
┌─────────────────────────────────────┐
│  Slide 1 │ Hook │ "Story over..."   │
├─────────────────────────────────────┤
│                                     │
│  i copied a creator with 1M...      │
│                                     │
│  ┌───────────────┐                  │
│  │ 🔄 Next Example │ (hover only)   │
│  └───────────────┘                  │
└─────────────────────────────────────┘
```

## Files to Create/Modify

### New Files
1. `src/components/ConceptQuickSelector.tsx` - Streamlined concept picker for empty slides

### Modified Files
1. `src/components/InlineEditableText.tsx` - Add empty state button support
2. `src/components/ProjectPostsTable.tsx` - Wire up the new components
3. `src/app/api/remixes/[id]/auto-fill-concepts/route.ts` - (Optional) Batch auto-fill endpoint

## State Management

Track in ProjectPostsTable:
```typescript
const [slideConceptState, setSlideConceptState] = useState<Map<string, {
  conceptId: string
  exampleIndex: number
  exampleIds: string[]
}>>(new Map())
```

Key: `${draftId}:${slideIndex}`
Value: Current concept and example cycling state

## Edge Cases

1. **No concepts of matching type**: Show message "No concepts available"
2. **Slide not classified**: Disable the button, show tooltip "Classify slide first"
3. **Single example in concept**: Disable cycling, or show "Only 1 example"
4. **All slides already have content**: Hide the auto-fill prompt
5. **Mixed empty/filled slides**: Only auto-fill empty slides

## Testing Checklist

- [ ] Empty slide shows "Select Example" button
- [ ] Clicking opens concept picker
- [ ] Selecting example applies text
- [ ] "Next Example" cycles through examples
- [ ] HOOK selection offers auto-fill
- [ ] Auto-fill populates all empty slides
- [ ] Fix Coherence works after auto-fill
- [ ] Optimistic updates work correctly
- [ ] Error states handled gracefully
