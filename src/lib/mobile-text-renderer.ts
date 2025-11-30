/**
 * Mobile Text Renderer
 *
 * Renders slide images with text overlays for TikTok sharing.
 * Uses Canvas API directly for reliable cross-browser rendering.
 */

import type { TextOverlay } from './text-overlay-utils';
import { TARGET_WIDTH, TARGET_HEIGHT } from './text-overlay-utils';
import {
  calculatePillLines,
  generatePillPath,
  getTotalHeight,
  getDefaultPillConfig,
  type PillLine,
  type PillRenderConfig,
} from './text-pill-renderer';

/**
 * Load an image and return it as HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));

    img.src = url;
  });
}

/**
 * Wait for font to be loaded
 */
async function waitForFont(fontName: string): Promise<void> {
  try {
    await document.fonts.load(`600 48px ${fontName}`);
    await document.fonts.load(`700 48px ${fontName}`);
  } catch {
    console.warn(`Font ${fontName} may not be fully loaded`);
  }
}

/**
 * Draw background image with cover fit and vertical offset
 */
function drawBackgroundImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  offsetY: number
): void {
  const canvasWidth = TARGET_WIDTH;
  const canvasHeight = TARGET_HEIGHT;
  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;

  // Calculate cover dimensions
  const canvasRatio = canvasWidth / canvasHeight;
  const imgRatio = imgWidth / imgHeight;

  let drawWidth: number;
  let drawHeight: number;
  let drawX: number;
  let drawY: number;

  if (imgRatio > canvasRatio) {
    // Image is wider - fit height, crop width
    drawHeight = canvasHeight;
    drawWidth = imgWidth * (canvasHeight / imgHeight);
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  } else {
    // Image is taller - fit width, crop height
    drawWidth = canvasWidth;
    drawHeight = imgHeight * (canvasWidth / imgWidth);
    drawX = 0;
    // Apply vertical offset (0 = top, 0.5 = center, 1 = bottom)
    const maxOffset = drawHeight - canvasHeight;
    drawY = -maxOffset * offsetY;
  }

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

/**
 * Parse SVG path and draw it on canvas
 */
function drawSvgPath(ctx: CanvasRenderingContext2D, pathData: string, offsetX: number, offsetY: number): void {
  if (!pathData) return;

  const path = new Path2D();

  // Parse the path data and apply offset
  // Split by commands while keeping the commands
  const commands = pathData.match(/[MLAZQ][^MLAZQ]*/gi) || [];

  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));

    switch (type) {
      case 'M':
        if (args.length >= 2) path.moveTo(args[0] + offsetX, args[1] + offsetY);
        break;
      case 'L':
        if (args.length >= 2) path.lineTo(args[0] + offsetX, args[1] + offsetY);
        break;
      case 'A':
        // Arc: rx ry x-axis-rotation large-arc-flag sweep-flag x y
        if (args.length >= 7) {
          // Canvas doesn't have direct arc command, use arcTo approximation
          // For simplicity, we'll draw a line to the endpoint for now
          // This works because our arcs are quarter circles
          const endX = args[5] + offsetX;
          const endY = args[6] + offsetY;
          path.lineTo(endX, endY);
        }
        break;
      case 'Z':
        path.closePath();
        break;
    }
  }

  ctx.fill(path);
}

/**
 * Draw pill-style text overlay with rounded background
 */
function drawPillOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  pillLines: PillLine[],
  pillConfig: PillRenderConfig,
  pillPath: string,
  totalHeight: number
): void {
  const margin = TARGET_WIDTH * 0.05;
  const centerY = overlay.y * TARGET_HEIGHT;
  const topY = centerY - totalHeight / 2;

  // Draw white pill background using Path2D with proper arc support
  ctx.fillStyle = '#ffffff';

  const { fontSize, paddingY, borderRadius, lineHeight } = pillConfig;
  const pillHeight = fontSize * lineHeight + paddingY * 2;
  const r = Math.min(borderRadius, pillHeight / 2);

  // Draw each line's pill shape properly
  for (const line of pillLines) {
    if (!line.text.trim()) continue;

    const x = margin + line.x;
    const y = topY + line.y;
    const width = line.width;
    const height = pillHeight;

    // Draw rounded rectangle
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
  }

  // Draw text
  ctx.fillStyle = '#000000';
  ctx.font = `600 ${overlay.fontSize}px Poppins, sans-serif`;
  ctx.textBaseline = 'top';

  const { paddingX, paddingY: padY } = pillConfig;

  for (const line of pillLines) {
    if (!line.text) continue;
    const x = margin + line.x + paddingX;
    const y = topY + line.y + padY + (overlay.fontSize * 0.15); // Adjust for baseline
    ctx.fillText(line.text, x, y);
  }
}

/**
 * Draw outline-style text overlay with stroke effect
 */
function drawOutlineOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay
): void {
  const margin = TARGET_WIDTH * 0.05;
  const innerWidth = TARGET_WIDTH - margin * 2;
  const centerY = overlay.y * TARGET_HEIGHT;

  ctx.font = `700 ${overlay.fontSize}px Poppins, sans-serif`;
  ctx.textBaseline = 'middle';

  // Calculate text position based on alignment
  let x: number;
  switch (overlay.alignment) {
    case 'left':
      ctx.textAlign = 'left';
      x = margin;
      break;
    case 'right':
      ctx.textAlign = 'right';
      x = TARGET_WIDTH - margin;
      break;
    case 'center':
    default:
      ctx.textAlign = 'center';
      x = TARGET_WIDTH / 2;
      break;
  }

  // Split text into lines
  const lines = overlay.text.split('\n');
  const lineHeightPx = overlay.fontSize * 1.6;
  const totalTextHeight = lines.length * lineHeightPx;
  const startY = centerY - totalTextHeight / 2 + lineHeightPx / 2;

  // Draw each line
  lines.forEach((line, index) => {
    const y = startY + index * lineHeightPx;

    // Draw black outline (stroke)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(line, x, y);

    // Draw white fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, x, y);
  });
}

/**
 * Render a slide with text overlays to PNG blob.
 *
 * @param imageUrl - The background image URL (presigned R2 URL)
 * @param imageOffsetY - Vertical offset (0=top, 0.5=center, 1=bottom)
 * @param textOverlays - Array of text overlays to render
 * @returns PNG blob ready for sharing
 */
export async function renderSlideWithOverlays(
  imageUrl: string,
  imageOffsetY: number,
  textOverlays: TextOverlay[]
): Promise<Blob> {
  // Ensure font is loaded
  await waitForFont('Poppins');

  // Load the background image
  const img = await loadImage(imageUrl);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  // Draw background image
  drawBackgroundImage(ctx, img, imageOffsetY);

  // Draw text overlays
  const margin = TARGET_WIDTH * 0.05;
  const innerWidth = TARGET_WIDTH - margin * 2;

  for (const overlay of textOverlays) {
    if (overlay.style === 'pill') {
      const pillConfig = getDefaultPillConfig(
        overlay.fontSize,
        innerWidth,
        overlay.alignment,
        overlay.maxWidth
      );
      const pillLines = calculatePillLines(overlay.text, pillConfig, innerWidth);
      const pillPath = generatePillPath(pillLines, pillConfig);
      const totalHeight = getTotalHeight(pillLines, pillConfig);

      drawPillOverlay(ctx, overlay, pillLines, pillConfig, pillPath, totalHeight);
    } else {
      drawOutlineOverlay(ctx, overlay);
    }
  }

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Render multiple slides with text overlays.
 *
 * @param slides - Array of slide data
 * @returns Array of PNG blobs
 */
export async function renderSlidesWithOverlays(
  slides: Array<{
    imageUrl: string;
    imageOffsetY: number;
    textOverlays: TextOverlay[];
  }>
): Promise<Blob[]> {
  const blobs: Blob[] = [];

  // Process slides one at a time to avoid memory issues
  for (const slide of slides) {
    const blob = await renderSlideWithOverlays(
      slide.imageUrl,
      slide.imageOffsetY,
      slide.textOverlays
    );
    blobs.push(blob);
  }

  return blobs;
}
