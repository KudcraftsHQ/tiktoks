/**
 * Text Overlay Utilities
 *
 * Parsing and utility functions for mobile text overlay editor.
 */

// Target canvas dimensions (TikTok optimal 3:4 portrait)
export const TARGET_WIDTH = 1080;
export const TARGET_HEIGHT = 1440;

export type TextOverlayStyle = 'pill' | 'outline';
export type TextOverlayAlignment = 'left' | 'center' | 'right';

export interface TextOverlay {
  id: string;
  text: string;
  // Position (normalized 0-1, relative to canvas)
  x: number;
  y: number;
  // Styling
  fontSize: number; // in pixels, base for 1080x1440 canvas
  alignment: TextOverlayAlignment;
  style: TextOverlayStyle;
  maxWidth: number; // 0-1, percentage of container width (0.5 = 50%, 0.95 = 95%)
}

export interface SlideOverlayState {
  slideId: string;
  textOverlays: TextOverlay[];
}

/**
 * Parse paraphrasedText into initial text overlays.
 * Splits by double newline (\n\n) into separate text boxes.
 */
export function parseTextToOverlays(text: string): TextOverlay[] {
  if (!text || !text.trim()) {
    return [];
  }

  // Split by double newline (paragraph breaks)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  if (paragraphs.length === 0) {
    return [];
  }

  // Create text overlays distributed vertically
  return paragraphs.map((paragraph, index) => {
    // Calculate vertical position: distribute evenly across the canvas
    // Leave margin at top and bottom (10% each)
    const totalHeight = 0.8; // 80% of canvas height for text
    const startY = 0.1; // Start at 10%

    let y: number;
    if (paragraphs.length === 1) {
      // Single text box: center it
      y = 0.5;
    } else {
      // Multiple: distribute evenly
      y = startY + (totalHeight * index) / (paragraphs.length - 1 || 1);
    }

    return {
      id: `overlay-${Date.now()}-${index}`,
      text: paragraph.trim(),
      x: 0.5, // Centered horizontally
      y,
      fontSize: 48, // Default font size (relative to 1080px)
      alignment: 'center' as TextOverlayAlignment,
      style: 'pill' as TextOverlayStyle,
      maxWidth: 0.6, // Default 60% of container width
    };
  });
}

/**
 * Minimal touch point interface for distance calculations
 */
interface TouchPoint {
  clientX: number;
  clientY: number;
}

/**
 * Calculate distance between two touch points
 */
export function getTouchDistance(touch1: TouchPoint, touch2: TouchPoint): number {
  return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
}

/**
 * Calculate the center point between two touches
 */
export function getTouchCenter(
  touch1: TouchPoint,
  touch2: TouchPoint
): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

/**
 * Scale font size based on container width
 * Font sizes are stored relative to 1080px width
 */
export function scaleFont(baseFontSize: number, containerWidth: number): number {
  return baseFontSize * (containerWidth / TARGET_WIDTH);
}

/**
 * Convert container-relative position to normalized (0-1)
 */
export function normalizePosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1, x / containerWidth)),
    y: Math.max(0, Math.min(1, y / containerHeight)),
  };
}

/**
 * Convert normalized position (0-1) to container-relative
 */
export function denormalizePosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: x * containerWidth,
    y: y * containerHeight,
  };
}

/**
 * Clamp position to keep text within safe bounds
 * Uses 5% margin from edges
 */
export function clampPosition(x: number, y: number): { x: number; y: number } {
  const margin = 0.05;
  return {
    x: Math.max(margin, Math.min(1 - margin, x)),
    y: Math.max(margin, Math.min(1 - margin, y)),
  };
}

/**
 * Clamp font size within reasonable bounds
 */
export function clampFontSize(fontSize: number): number {
  const MIN_FONT_SIZE = 20;
  const MAX_FONT_SIZE = 120;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize));
}

/**
 * Generate unique ID for text overlay
 */
export function generateOverlayId(): string {
  return `overlay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
