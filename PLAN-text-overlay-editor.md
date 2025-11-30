# Plan: Mobile Text Overlay Editor

## Overview

Extend the mobile sharing feature (`/mobile/drafts/[id]`) with a simple text overlay editor that renders text onto slide images before sharing to TikTok. The critical requirement is that the **rendered output shared to TikTok must be pixel-perfect identical to what users see during editing**.

## Current State Analysis

### Existing Flow
1. User views draft slides on `/mobile/drafts/[id]`
2. Each slide shows the background image (3:4 cropped) with `paraphrasedText` displayed below (not on image)
3. User can adjust vertical image position via `ImagePositionEditor`
4. `cropImageTo3x4()` crops images client-side using Canvas API
5. Cropped images are shared via Web Share API

### Gap
Text is **never rendered onto images**. The `paraphrasedText` is only displayed for reference/copying, not composited.

---

## Architecture Decision: Rendering Approach

### The Problem
Tailwind CSS v4 uses OKLCH color space, and we need the preview (HTML/CSS) to match the exported image (Canvas/PNG) exactly.

### Options Evaluated

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **html-to-image** | Captures exact DOM rendering, easy implementation | Adds dependency, potential CORS issues | ✅ Recommended |
| **modern-screenshot** | Modern alternative, better CSS support | Newer/less tested | ✅ Alternative |
| **Canvas-only** | Guaranteed match | Complex touch gestures, harder styling | ❌ Too complex |
| **Satori + resvg** | Already in project | No `box-decoration-break` support | ❌ CSS limitations |
| **Server-side Konva** | Consistent rendering | Color space matching issues, latency | ❌ Not viable |

### Recommended: `modern-screenshot` (or `html-to-image`)

**Rationale:**
1. **Exact visual fidelity**: Captures the actual rendered DOM including all CSS
2. **OKLCH support**: Since it screenshots the browser's rendering, OKLCH colors are preserved
3. **Simple implementation**: Preview is normal HTML/CSS, export just captures it
4. **Touch-friendly**: DOM elements have native touch event support

**Library choice**: `modern-screenshot` over `html-to-image` because:
- Better maintained (2024 updates)
- Smaller bundle size
- Better CSS feature support
- Handles web fonts properly

---

## Data Model

### Text Overlay State (Client-side only, not persisted)

```typescript
interface TextOverlay {
  id: string;
  text: string;
  // Position (normalized 0-1, relative to canvas)
  x: number;
  y: number;
  // Styling
  fontSize: number; // in pixels, base for the 1080x1440 canvas
  alignment: 'left' | 'center' | 'right';
  style: 'pill' | 'outline';
}

interface SlideOverlayState {
  slideId: string;
  textOverlays: TextOverlay[];
}
```

### Style Definitions

**Style 1: Pill (White background, black text)**
```css
.text-overlay-pill {
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  color: black;
  background: white;
  display: inline;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  padding: 0.15em 0.5em;
  border-radius: 0.3em;
  line-height: 2.2;
}
```

**Style 2: Outline (White text, black stroke)**
```css
.text-overlay-outline {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  color: white;
  text-shadow:
    -2px -2px 0 black,
    2px -2px 0 black,
    -2px 2px 0 black,
    2px 2px 0 black,
    -2px 0 0 black,
    2px 0 0 black,
    0 -2px 0 black,
    0 2px 0 black;
}
```

---

## Implementation Components

### 1. New Dependencies

```bash
bun add modern-screenshot
```

### 2. New Components

#### `TextOverlayEditor.tsx`
Full-screen modal editor for a single slide:
- Shows the slide image as background (cropped to 3:4)
- Renders text overlays on top
- Touch handlers for:
  - Single finger drag: Move text box
  - Two-finger pinch: Resize text
- Bottom toolbar with:
  - Alignment toggle (L/C/R icons)
  - Style toggle (pill/outline icons)
  - Done/Cancel buttons

#### `TextOverlayBox.tsx`
Individual draggable/resizable text overlay:
- Renders text with chosen style
- Touch event handlers for drag and pinch
- Selection state (shows handles when selected)

#### `OverlayToolbar.tsx`
Bottom toolbar for editing controls:
- Alignment: 3 buttons (left, center, right)
- Style: 2 buttons (pill, outline)
- Respects safe area insets

### 3. Modified Components

#### `MobileDraftDetailPage.tsx`
- Add state for text overlays per slide
- Initialize overlays from `paraphrasedText` (split by `\n\n`)
- Add "Edit Text" button to open `TextOverlayEditor`
- Update `prepareImagesForShare` to use new rendering function

#### `SlideCard.tsx`
- Add preview of text overlays on image
- Add "Edit Text" button

### 4. New Utilities

#### `mobile-text-renderer.ts`
```typescript
// Render slide with text overlays to PNG blob
export async function renderSlideWithOverlays(
  imageUrl: string,
  offsetY: number,
  textOverlays: TextOverlay[],
  canvasElement: HTMLElement // Reference to the preview DOM element
): Promise<Blob>
```

#### `text-overlay-utils.ts`
```typescript
// Parse paraphrasedText into initial text overlays
export function parseTextToOverlays(text: string): TextOverlay[]

// Calculate pinch gesture scale
export function calculatePinchScale(touch1: Touch, touch2: Touch, prevDistance: number): number
```

---

## User Flow

### Viewing a Draft
1. User opens `/mobile/drafts/[id]`
2. Each slide shows image with text overlays rendered on top (preview)
3. Text overlays are initialized from `paraphrasedText`:
   - Split by `\n\n` (double newline) into separate boxes
   - Default position: centered horizontally, distributed vertically
   - Default style: `pill`
   - Default alignment: `center`

### Editing Text Overlays
1. User taps "Edit Text" on a slide
2. `TextOverlayEditor` modal opens full-screen
3. User can:
   - **Tap** a text box to select it
   - **Drag** (single finger) to reposition
   - **Pinch** (two fingers) to resize
   - Use toolbar to change alignment/style
4. User taps "Done" to save changes
5. Preview updates immediately

### Sharing to TikTok
1. User taps "Share to TikTok"
2. For each slide:
   a. Render the preview DOM element to PNG using `modern-screenshot`
   b. The DOM element includes both the cropped image AND text overlays
   c. Convert to File object
3. Share via Web Share API

---

## Technical Details

### Font Loading
Ensure Poppins is loaded before rendering:

```typescript
// In layout.tsx or component
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-poppins',
});
```

### Canvas Dimensions
- Preview: Responsive (fills screen width, maintains 3:4 aspect)
- Export: Fixed 1080x1440 pixels (TikTok optimal)

### Font Size Scaling
```typescript
// Font size is stored relative to 1080px width
// When rendering preview, scale based on actual width
const previewScale = previewWidth / 1080;
const displayFontSize = overlay.fontSize * previewScale;
```

### Pinch-to-Resize Implementation
```typescript
interface PinchState {
  initialDistance: number;
  initialFontSize: number;
}

function handleTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    const scale = currentDistance / pinchState.initialDistance;
    const newFontSize = Math.max(20, Math.min(120, pinchState.initialFontSize * scale));
    setFontSize(newFontSize);
  }
}
```

### Rendering Pipeline
```typescript
async function renderSlideForShare(
  containerRef: HTMLElement,
  targetWidth: number = 1080,
  targetHeight: number = 1440
): Promise<Blob> {
  const { domToPng } = await import('modern-screenshot');

  // Render at exact target dimensions
  const dataUrl = await domToPng(containerRef, {
    width: targetWidth,
    height: targetHeight,
    scale: 1,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
  });

  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  return response.blob();
}
```

---

## File Structure

```
src/
├── app/(mobile)/mobile/drafts/[id]/
│   └── page.tsx                    # Modified: Add overlay state
├── components/mobile/
│   ├── TextOverlayEditor.tsx       # NEW: Full-screen editor modal
│   ├── TextOverlayBox.tsx          # NEW: Individual text overlay
│   ├── OverlayToolbar.tsx          # NEW: Bottom toolbar
│   ├── SlideCard.tsx               # Modified: Show overlay preview
│   └── ShareButton.tsx             # Modified: Use new renderer
└── lib/
    ├── mobile-image-cropper.ts     # Existing
    ├── mobile-text-renderer.ts     # NEW: Composite rendering
    └── text-overlay-utils.ts       # NEW: Parsing utilities
```

---

## Styling Specifications (from reference images)

### Pill Style (Primary)
Based on the reference images:
- **Font**: Poppins, semi-bold (600) or bold (700)
- **Background**: Pure white (`#FFFFFF`)
- **Text color**: Pure black (`#000000`)
- **Padding**: `0.15em` top/bottom, `0.5em` left/right
- **Border radius**: `0.3em` (relative to font size)
- **Line height**: `2.2` (creates vertical spacing between lines)
- **Box decoration break**: `clone` (each line gets its own background)

### Outline Style
- **Font**: Poppins, bold (700)
- **Text color**: Pure white (`#FFFFFF`)
- **Outline**: 2px black stroke (via text-shadow for cross-browser support)
- **No background**

---

## Edge Cases & Considerations

### 1. Empty Text
- If `paraphrasedText` is empty, don't create any overlays
- User cannot add new text boxes (only edit existing)

### 2. Very Long Text
- Wrap text within the overlay box
- User can resize to accommodate

### 3. Text Near Edges
- Clamp position to keep text within safe bounds
- Minimum 5% margin from edges

### 4. Performance
- Debounce position updates during drag
- Use `will-change: transform` for smooth animations
- Render exports one at a time to avoid memory issues

### 5. Font Loading
- Wait for Poppins font to load before enabling share
- Show loading state if fonts not ready

---

## Implementation Order

1. **Add `modern-screenshot` dependency**
2. **Create `text-overlay-utils.ts`** - Parsing and utility functions
3. **Create `TextOverlayBox.tsx`** - Basic text rendering with styles
4. **Create `OverlayToolbar.tsx`** - Alignment and style controls
5. **Create `TextOverlayEditor.tsx`** - Full editor modal with touch gestures
6. **Modify `SlideCard.tsx`** - Add overlay preview and edit button
7. **Create `mobile-text-renderer.ts`** - modern-screenshot integration
8. **Modify `MobileDraftDetailPage.tsx`** - State management and integration
9. **Update sharing flow** - Use new renderer in share pipeline

---

## Success Criteria

1. ✅ Text overlays render on slide preview
2. ✅ Drag to reposition works smoothly on mobile
3. ✅ Pinch to resize works accurately
4. ✅ Alignment changes apply correctly (left/center/right)
5. ✅ Style toggle switches between pill and outline
6. ✅ Shared images look **identical** to preview
7. ✅ Poppins font renders correctly in both preview and export
8. ✅ Performance is acceptable (< 2s per slide render)

---

## Open Questions for User

1. **Text editing**: Should users be able to edit the actual text content, or only position/style?
2. **Persistence**: Should text overlay positions be saved to the database, or only session-local?
3. **Multiple text boxes**: Should users be able to add/remove text boxes, or only work with the auto-generated ones from `paraphrasedText`?
4. **Undo/redo**: Is undo functionality needed?
