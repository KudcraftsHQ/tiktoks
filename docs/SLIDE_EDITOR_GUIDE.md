# Slide Editor System - Complete Guide

## Overview

The Slide Editor system enables fast creation and editing of carousel slides with a focus on speed and efficiency. It consists of thumbnail previews, inline editing, and a full-featured dialog editor.

## Architecture

### Component Hierarchy

```
ProjectPostsTable (existing)
├── DraftRowContent (new)
│   ├── ThumbnailStrip
│   │   └── SlideThumbnail × 6
│   └── SlideGrid
│       └── SlideCard × 6
│
SlideEditDialog (standalone)
├── Preview Panel
│   └── DraggableTextBox (reused from full editor)
└── Controls Panel
    ├── Background Selector
    ├── Style Presets
    ├── Text Box List
    └── Apply to All
```

### Core Files

**Libraries:**
- `src/lib/style-presets.ts` - Predefined text styles and smart layout logic
- `src/lib/slide-renderer.ts` - Canvas-based thumbnail generation

**Components:**
- `src/components/SlideThumbnail.tsx` - Individual thumbnail with caching
- `src/components/ThumbnailStrip.tsx` - Horizontal scrollable strip
- `src/components/SlideCard.tsx` - Inline editable slide card
- `src/components/SlideGrid.tsx` - Expandable grid of slides
- `src/components/DraftRowContent.tsx` - Complete draft row
- `src/components/SlideEditDialog.tsx` - Full editor dialog

**API:**
- `src/app/api/remixes/route.ts` - Auto-generates slides with presets

**Test Page:**
- `src/app/test-slides/page.tsx` - Demo of all features

## Features

### 1. Auto-Generation

When creating a new draft:
- Automatically generates 6 slides
- First slide: Hook style (Centered Bold Box)
- Last slide: CTA style (Bottom Caption)
- Middle slides: Content style (Centered Bold Box)
- Each slide gets placeholder text
- White background by default

### 2. Thumbnail Previews

**Location:** Author column in draft rows

**Features:**
- Canvas-rendered previews (48×85px)
- Global caching system (avoids re-renders)
- Loading states
- Click to open editor dialog
- Auto-updates when text changes

**Caching Strategy:**
```typescript
// Cache key includes slide content
const cacheKey = JSON.stringify({
  bg: backgroundLayers,
  text: textBoxes (positions, styles, content)
})

// Automatic invalidation on changes
invalidateSlideThumbnail(slide)
```

### 3. Inline Editing

**Location:** Content column (expanded view)

**Features:**
- Click "Expand" to show slide grid
- 2-column layout of slide cards
- Direct textarea editing
- Auto-save after 1 second debounce
- Character count display
- Slide type badges (Hook/Content/CTA)
- Edit button opens dialog

**Usage:**
```tsx
<SlideGrid
  slides={slides}
  isExpanded={isExpanded}
  onToggleExpand={() => setIsExpanded(!isExpanded)}
  onSlideTextChange={(index, text) => handleSave(index, text)}
  onSlideEditClick={(index) => openDialog(index)}
/>
```

### 4. Dialog Editor

**Opening:**
- Click any thumbnail in the strip
- Click edit icon on slide card

**Layout:**
- Left panel (60%): Interactive canvas preview
- Right panel (40%): Controls (scrollable)
- Footer: Cancel, Advanced Editor, Save buttons

**Preview Panel:**
- Scaled-down canvas (400×711px)
- Draggable text boxes
- Resize handles
- Live updates

**Controls Panel:**

a) **Background Selection**
   - Empty (white)
   - Original post images (if available)
   - Custom upload (future)

b) **Style Presets**
   - Centered Bold Box
   - Bottom Caption
   - Optimize Layout (smart suggestions)

c) **Text Box Controls**
   - Width slider (30-100%)
   - Horizontal align (Left/Center/Right)
   - Vertical position (Top/Middle/Bottom)

d) **Text Box Management**
   - List of all text boxes
   - Split at line breaks (scissors icon)
   - Duplicate (copy icon)
   - Delete (trash icon)
   - Add new (+  button)

e) **Apply to All**
   - Checkbox to enable
   - Select aspects:
     - Background image
     - Style preset (fonts, colors, padding)
     - Text box positions
   - Keeps original text intact

### 5. Smart Layout

**Text Analysis:**
```typescript
analyzeText(text, fontSize, boxWidth) → {
  characterCount,
  wordCount,
  estimatedLines,
  hasLineBreaks,
  longestWord
}
```

**Layout Suggestions:**
- Short text (< 50 chars): Larger font (52px), centered
- Medium text (50-120 chars): Standard preset
- Long text (> 120 chars): Smaller font (36px), wider box

**Slide Type Detection:**
- First slide → Hook style
- Last slide (if > 2 total) → CTA style
- Others → Content style

### 6. Apply to All

**How It Works:**

1. User edits one slide in dialog
2. Checks "Apply to all slides"
3. Selects which aspects to apply:
   - Background image ✓
   - Style preset ✓
   - Text box positions ✓

4. Clicks Save

5. System applies changes to all slides:
   ```typescript
   slides.forEach(slide => {
     if (aspects.background) {
       slide.backgroundLayers = sourceSlide.backgroundLayers
     }
     if (aspects.stylePreset) {
       slide.textBoxes = slide.textBoxes.map((tb, i) => ({
         ...tb,
         text: tb.text, // Keep original!
         // Copy all style properties from source
         fontSize: sourceTb.fontSize,
         color: sourceTb.color,
         // ...etc
       }))
     }
     // ... more aspects
   })
   ```

**Key Points:**
- Original text is ALWAYS preserved
- Only selected aspects are copied
- All slides updated in one save operation
- Thumbnail cache invalidated for all slides

## API Integration

### Creating a Draft

**Endpoint:** `POST /api/remixes`

**Request:**
```json
{
  "name": "My Draft",
  "description": "Optional description",
  "slideCount": 6
}
```

**Response:**
```json
{
  "remix": {
    "id": "...",
    "slides": [
      {
        "id": "slide_1",
        "displayOrder": 0,
        "canvas": { "width": 1080, "height": 1920, "unit": "px" },
        "backgroundLayers": [{ "type": "color", "color": "#ffffff", ... }],
        "textBoxes": [
          {
            "id": "text_1",
            "text": "Hook: Start with something attention-grabbing",
            "x": 0.1,
            "y": 0.35,
            "width": 0.8,
            "height": 0.3,
            "fontSize": 44,
            "fontFamily": "Poppins",
            "fontWeight": "bold",
            "backgroundColor": "#ffffff",
            "borderRadius": 12,
            // ...more properties
          }
        ],
        "paraphrasedText": "Hook: Start with something attention-grabbing"
      }
      // ... 5 more slides
    ]
  }
}
```

### Updating Slides

**Endpoint:** `PUT /api/remixes/:id`

**Request:**
```json
{
  "slides": [ /* updated slides array */ ]
}
```

## Performance Optimizations

### 1. Thumbnail Caching

```typescript
// Global cache
const thumbnailCache = new Map<string, string>()

// Cache key = slide content hash + size
const key = getSlideCacheKey(slide) + size

// Check cache before rendering
if (thumbnailCache.has(key)) {
  return cached value
}

// Render and cache
const dataUrl = await renderSlideToDataURL(slide)
thumbnailCache.set(key, dataUrl)
```

### 2. Debounced Saves

```typescript
// Inline editing
const debouncedSave = debounce((text) => {
  saveToAPI(text)
}, 1000)

// Thumbnail regeneration
const debouncedRegenerate = debounce((slideIndex) => {
  invalidateSlideThumbnail(slide)
  refetchData()
}, 500)
```

### 3. Canvas Rendering

- Render at full size (1080×1920)
- Scale down to thumbnail size
- Use high-quality image smoothing
- Reuse canvas elements

### 4. Selective Updates

- Only update changed slides
- Only regenerate affected thumbnails
- Batch updates when possible

## Usage Examples

### Example 1: Create and Edit a Draft

```typescript
// 1. Create draft
const response = await fetch('/api/remixes', {
  method: 'POST',
  body: JSON.stringify({
    name: 'TikTok Algorithm Tips',
    slideCount: 6
  })
})

const { remix } = await response.json()

// 2. Render in table
<DraftRowContent
  draft={remix}
  onSlideEditClick={(draftId, slideIndex) => {
    openDialog(draftId, slideIndex)
  }}
/>

// 3. Edit in dialog
<SlideEditDialog
  open={true}
  slide={remix.slides[0]}
  slideIndex={0}
  remixId={remix.id}
  onSave={async (updates) => {
    await updateSlide(remix.id, 0, updates)
  }}
/>
```

### Example 2: Apply Style to All Slides

```typescript
// 1. User opens slide 1
// 2. Changes font to 48px, color to red
// 3. Checks "Apply to all slides"
// 4. Checks "Style preset"
// 5. Clicks Save

// Backend processes:
const sourceSlide = updatedSlide
remix.slides = remix.slides.map(slide => ({
  ...slide,
  textBoxes: slide.textBoxes.map((tb, i) => ({
    ...tb,
    text: tb.text, // KEEP ORIGINAL
    fontSize: sourceSlide.textBoxes[i].fontSize, // 48px
    color: sourceSlide.textBoxes[i].color, // red
    // ... other style properties
  }))
}))

// Result: All slides now have 48px red text,
// but each keeps its own content!
```

### Example 3: Split and Reposition Text

```typescript
// Original text box:
"Line 1\nLine 2\nLine 3"

// User clicks split button

// Result: 3 separate text boxes
[
  { text: "Line 1", y: 0.3 },
  { text: "Line 2", y: 0.45 },
  { text: "Line 3", y: 0.6 }
]

// User drags them around individually
// Each can now have different positions/styles
```

## Testing

### Test Page

Visit `/test-slides` to try all features:

1. **Thumbnail Strip:** Click thumbnails to open editor
2. **Expand Grid:** See all slides with editable text
3. **Inline Edit:** Type in textareas, auto-saves
4. **Dialog Editor:** Full editing capabilities
5. **Apply to All:** Test bulk updates

### Manual Testing Checklist

- [ ] Create new draft → 6 slides generated
- [ ] Thumbnails render correctly
- [ ] Click thumbnail opens dialog
- [ ] Expand slide grid works
- [ ] Inline text editing saves
- [ ] Thumbnails update after text change
- [ ] Drag text boxes in dialog
- [ ] Resize text boxes
- [ ] Change background
- [ ] Apply style preset
- [ ] Add new text box
- [ ] Split multi-line text
- [ ] Duplicate text box
- [ ] Delete text box
- [ ] Apply to all slides (background)
- [ ] Apply to all slides (style)
- [ ] Apply to all slides (positions)
- [ ] Original text preserved after "Apply to All"
- [ ] Advanced Editor link works

## Troubleshooting

### Thumbnails Not Rendering

**Cause:** Canvas API not available or font not loaded

**Solution:**
```typescript
// Check if canvas is available
if (!document.createElement('canvas').getContext) {
  // Fallback to placeholder
}

// Ensure fonts are loaded
await document.fonts.ready
```

### Slow Performance

**Cause:** Too many thumbnail regenerations

**Solution:**
- Check cache is working
- Increase debounce delay
- Batch updates

### Dialog Overflow

**Cause:** Content too large for viewport

**Solution:**
- Use `ScrollArea` for controls panel
- Set `max-h-[95vh]` on dialog
- Use `overflow-hidden` on containers

### Text Not Saving

**Cause:** Debounce timing or API error

**Solution:**
- Check network tab for 429/500 errors
- Increase debounce delay
- Add retry logic

## Future Enhancements

1. **Background Images:**
   - Load from original post
   - Upload custom images
   - Image library integration

2. **More Style Presets:**
   - Left-aligned
   - Right-aligned
   - Full-screen text
   - Minimal
   - Bold headline

3. **Advanced Features:**
   - Copy slide
   - Reorder slides (drag-and-drop)
   - Slide templates
   - Undo/redo
   - Keyboard shortcuts

4. **AI Integration:**
   - Auto-suggest layouts
   - Auto-optimize text length
   - Generate variations
   - A/B test recommendations

5. **Collaboration:**
   - Real-time editing
   - Comments
   - Version history
   - Approval workflow

## Migration Guide

### Integrating into Existing Code

To add the slide editor to your project table:

1. **Replace draft row rendering:**
   ```tsx
   // Before
   {draft.slides.map(slide => <TextArea value={slide.text} />)}

   // After
   <DraftRowContent
     draft={draft}
     onSlideEditClick={openDialog}
   />
   ```

2. **Add dialog state:**
   ```tsx
   const [selectedSlide, setSelectedSlide] = useState(null)

   <SlideEditDialog
     open={!!selectedSlide}
     onClose={() => setSelectedSlide(null)}
     slide={selectedSlide?.slide}
     slideIndex={selectedSlide?.index}
     remixId={draft.id}
     onSave={handleSave}
   />
   ```

3. **Update save logic:**
   ```tsx
   const handleSave = async (updates) => {
     // Check for Apply to All
     if (updates._applyToAll) {
       // Apply to all slides
       return applyToAllSlides(updates)
     }

     // Save single slide
     return saveSingleSlide(updates)
   }
   ```

## Support

For questions or issues:
1. Check this documentation
2. Review test page at `/test-slides`
3. Inspect component props in code
4. Check browser console for errors
5. Verify API responses in Network tab
