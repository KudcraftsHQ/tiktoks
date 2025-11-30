/**
 * Text Pill Renderer
 *
 * Renders text with connected pill-style backgrounds using SVG.
 * Lines are connected with smooth rounded corners at the junctions.
 */

export interface PillLine {
  text: string;
  width: number;
  x: number;
  y: number;
}

export interface PillRenderConfig {
  fontSize: number;
  maxWidth: number;
  alignment: 'left' | 'center' | 'right';
  paddingX: number;
  paddingY: number;
  borderRadius: number;
  lineHeight: number;
}

/**
 * Measure text width using canvas
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string = 'Poppins, sans-serif',
  fontWeight: string = '600'
): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.6;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.6;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/**
 * Wrap text to fit within maxWidth, breaking by word
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  fontFamily: string = 'Poppins, sans-serif',
  fontWeight: string = '600'
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextWidth(testLine, fontSize, fontFamily, fontWeight);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Calculate pill lines with positions and widths
 */
export function calculatePillLines(
  text: string,
  config: PillRenderConfig,
  containerWidth: number
): PillLine[] {
  const { fontSize, maxWidth, alignment, paddingX, paddingY, lineHeight } = config;

  // Split by newlines first, then wrap each paragraph
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      allLines.push('');
    } else {
      const wrapped = wrapText(paragraph, fontSize, maxWidth);
      allLines.push(...wrapped);
    }
  }

  // Calculate the pill height (same for all lines)
  const pillHeight = fontSize * lineHeight + paddingY * 2;

  // Calculate positions for each line
  const pillLines: PillLine[] = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const textWidth = line ? measureTextWidth(line, fontSize) : fontSize; // Min width for empty
    const pillWidth = textWidth + paddingX * 2;

    // Calculate x position based on alignment
    let x: number;
    switch (alignment) {
      case 'left':
        x = 0;
        break;
      case 'right':
        x = containerWidth - pillWidth;
        break;
      case 'center':
      default:
        x = (containerWidth - pillWidth) / 2;
        break;
    }

    pillLines.push({
      text: line,
      width: pillWidth,
      x,
      y: i * pillHeight,
    });
  }

  return pillLines;
}

/**
 * Generate SVG path for connected pills with smooth rounded corners.
 * Creates a single continuous path that traces the entire outline.
 */
export function generatePillPath(
  lines: PillLine[],
  config: PillRenderConfig
): string {
  if (lines.length === 0) return '';

  const { fontSize, paddingY, borderRadius, lineHeight } = config;
  const pillHeight = fontSize * lineHeight + paddingY * 2;
  const r = Math.min(borderRadius, pillHeight / 2);

  // Filter out empty lines for the path (but keep positions)
  const nonEmptyLines = lines.filter((l) => l.text.trim() !== '');

  if (nonEmptyLines.length === 0) return '';

  if (nonEmptyLines.length === 1) {
    // Single line - simple rounded rectangle
    const line = nonEmptyLines[0];
    return roundedRect(line.x, line.y, line.width, pillHeight, r);
  }

  // Multiple lines - create ONE continuous path tracing the entire outline
  // This avoids gaps and overlap issues
  return generateUnifiedPillPath(nonEmptyLines, pillHeight, r);
}

/**
 * Generate a single unified path for all connected pills.
 * Traces clockwise around the entire shape with proper concave corners.
 */
function generateUnifiedPillPath(
  lines: PillLine[],
  pillHeight: number,
  r: number
): string {
  // Build arrays of left and right edges for each line
  const edges = lines.map((line) => ({
    left: line.x,
    right: line.x + line.width,
    top: line.y,
    bottom: line.y + pillHeight,
  }));

  let path = '';

  // Start at top-left of first line, after the rounded corner
  const first = edges[0];
  path += `M ${first.left + r} ${first.top} `;

  // Trace the RIGHT side going DOWN
  for (let i = 0; i < edges.length; i++) {
    const curr = edges[i];
    const next = i < edges.length - 1 ? edges[i + 1] : null;

    // Top-right corner of current (only for first line)
    if (i === 0) {
      path += `L ${curr.right - r} ${curr.top} `;
      path += `A ${r} ${r} 0 0 1 ${curr.right} ${curr.top + r} `;
    }

    if (next) {
      // Calculate the width difference
      const rightDiff = Math.abs(curr.right - next.right);
      // Minimum threshold - if difference is too small, just go straight (use wider edge)
      const minDiff = r * 0.6;

      if (rightDiff < minDiff) {
        // Difference too small - use the wider of the two and go straight down
        const maxRight = Math.max(curr.right, next.right);
        path += `L ${maxRight} ${curr.bottom} `;
      } else if (curr.right > next.right) {
        // Current is wider on the right - use full radius for concave
        path += `L ${curr.right} ${curr.bottom - r} `;
        path += `A ${r} ${r} 0 0 1 ${curr.right - r} ${curr.bottom} `;
        path += `L ${next.right + r} ${curr.bottom} `;
        path += `A ${r} ${r} 0 0 0 ${next.right} ${curr.bottom + r} `;
      } else {
        // Next is wider on the right - use full radius for concave
        path += `L ${curr.right} ${curr.bottom - r} `;
        path += `A ${r} ${r} 0 0 0 ${curr.right + r} ${curr.bottom} `;
        path += `L ${next.right - r} ${curr.bottom} `;
        path += `A ${r} ${r} 0 0 1 ${next.right} ${curr.bottom + r} `;
      }
    } else {
      // Last line - bottom-right corner
      path += `L ${curr.right} ${curr.bottom - r} `;
      path += `A ${r} ${r} 0 0 1 ${curr.right - r} ${curr.bottom} `;
    }
  }

  // Trace the BOTTOM of the last line
  const last = edges[edges.length - 1];
  path += `L ${last.left + r} ${last.bottom} `;
  path += `A ${r} ${r} 0 0 1 ${last.left} ${last.bottom - r} `;

  // Trace the LEFT side going UP
  for (let i = edges.length - 1; i >= 0; i--) {
    const curr = edges[i];
    const prev = i > 0 ? edges[i - 1] : null;

    if (prev) {
      // Calculate the width difference
      const leftDiff = Math.abs(curr.left - prev.left);
      // Minimum threshold - if difference is too small, just go straight (use wider edge)
      const minDiff = r * 0.6;

      if (leftDiff < minDiff) {
        // Difference too small - use the wider of the two (smaller left value) and go straight up
        const minLeft = Math.min(curr.left, prev.left);
        path += `L ${minLeft} ${curr.top} `;
      } else if (curr.left < prev.left) {
        // Current is wider on the left - use full radius for concave
        path += `L ${curr.left} ${curr.top + r} `;
        path += `A ${r} ${r} 0 0 1 ${curr.left + r} ${curr.top} `;
        path += `L ${prev.left - r} ${curr.top} `;
        path += `A ${r} ${r} 0 0 0 ${prev.left} ${curr.top - r} `;
      } else {
        // Previous is wider on the left - use full radius for concave
        path += `L ${curr.left} ${curr.top + r} `;
        path += `A ${r} ${r} 0 0 0 ${curr.left - r} ${curr.top} `;
        path += `L ${prev.left + r} ${curr.top} `;
        path += `A ${r} ${r} 0 0 1 ${prev.left} ${curr.top - r} `;
      }
    } else {
      // First line - top-left corner (close the path)
      path += `L ${curr.left} ${curr.top + r} `;
      path += `A ${r} ${r} 0 0 1 ${curr.left + r} ${curr.top} `;
    }
  }

  path += 'Z';

  return path;
}

/**
 * Generate notch fills - no longer needed with unified path approach
 * Kept for API compatibility but returns empty string
 */
export function generateNotchFills(
  lines: PillLine[],
  config: PillRenderConfig
): string {
  // Unified path handles all corners, no separate fills needed
  return '';
}

/**
 * Simple rounded rectangle path
 */
function roundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  r: number
): string {
  r = Math.min(r, width / 2, height / 2);
  return `M ${x + r} ${y}
          L ${x + width - r} ${y}
          A ${r} ${r} 0 0 1 ${x + width} ${y + r}
          L ${x + width} ${y + height - r}
          A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}
          L ${x + r} ${y + height}
          A ${r} ${r} 0 0 1 ${x} ${y + height - r}
          L ${x} ${y + r}
          A ${r} ${r} 0 0 1 ${x + r} ${y}
          Z`;
}

/**
 * Get total height of all pill lines
 */
export function getTotalHeight(
  lines: PillLine[],
  config: PillRenderConfig
): number {
  if (lines.length === 0) return 0;

  const { fontSize, paddingY, lineHeight } = config;
  const pillHeight = fontSize * lineHeight + paddingY * 2;

  return lines.length * pillHeight;
}

/**
 * Get pill height for a single line
 */
export function getPillHeight(config: PillRenderConfig): number {
  const { fontSize, paddingY, lineHeight } = config;
  return fontSize * lineHeight + paddingY * 2;
}

/**
 * Default config generator based on font size
 * @param maxWidthRatio - 0-1, percentage of container width (default 0.6 = 60%)
 */
export function getDefaultPillConfig(
  fontSize: number,
  containerWidth: number,
  alignment: 'left' | 'center' | 'right' = 'center',
  maxWidthRatio: number = 0.6
): PillRenderConfig {
  return {
    fontSize,
    maxWidth: containerWidth * maxWidthRatio,
    alignment,
    paddingX: fontSize * 0.45,
    paddingY: fontSize * 0.15,
    borderRadius: fontSize * 0.3,
    lineHeight: 1.25,
  };
}
