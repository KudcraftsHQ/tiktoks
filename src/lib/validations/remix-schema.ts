/**
 * Remix Schema Validation
 *
 * Comprehensive Zod schemas for RemixPost validation with canvas sizing and background layers
 */

import { z } from 'zod'

// Text Box Schema with advanced styling support
const RemixTextBoxSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(2000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1),
  height: z.number().min(0.01).max(1),
  fontSize: z.number().min(8).max(200),
  fontFamily: z.string().min(1).max(100),
  fontWeight: z.enum(['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900']),
  fontStyle: z.enum(['normal', 'italic', 'oblique']),
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textAlign: z.enum(['left', 'center', 'right', 'justify']),
  zIndex: z.number().min(1).max(1000),

  // Text wrapping behavior
  textWrap: z.enum(['none', 'wrap', 'ellipsis']).default('none'),

  // Advanced text styling
  textStroke: z.string().optional(),
  textShadow: z.string().optional(),
  borderWidth: z.number().min(0).max(50).optional(),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),

  // Text shadow effects
  enableShadow: z.boolean().default(false),
  shadowColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  shadowBlur: z.number().min(0).max(20).default(4),
  shadowOffsetX: z.number().min(-20).max(20).default(2),
  shadowOffsetY: z.number().min(-20).max(20).default(2),

  // Text outline effects
  outlineWidth: z.number().min(0).max(10).default(0),
  outlineColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),

  // Text background styling
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundOpacity: z.number().min(0).max(1).default(1),
  borderRadius: z.number().min(0).max(50).default(0),

  // Padding and spacing
  paddingTop: z.number().min(0).max(100).default(8),
  paddingRight: z.number().min(0).max(100).default(12),
  paddingBottom: z.number().min(0).max(100).default(8),
  paddingLeft: z.number().min(0).max(100).default(12),

  // Line height and letter spacing
  lineHeight: z.number().min(0.5).max(3).default(1.2),
  letterSpacing: z.number().min(-5).max(20).default(0)
})

// Canvas Size Schema
const CanvasSizeSchema = z.object({
  width: z.number().min(100).max(4000), // Canvas width in pixels
  height: z.number().min(100).max(4000), // Canvas height in pixels
  unit: z.enum(['px', 'pt']).default('px') // Unit for measurements
})

// Gradient Schema for background layers
const GradientSchema = z.object({
  type: z.enum(['linear', 'radial']),
  colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(2).max(5),
  angle: z.number().min(0).max(360).optional(), // For linear gradient
  centerX: z.number().min(0).max(1).optional(), // For radial gradient
  centerY: z.number().min(0).max(1).optional()
})

// Background Layer Schema
const BackgroundLayerSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['image', 'color', 'gradient']),

  // For image backgrounds
  imageId: z.string().uuid().optional(),

  // Position and scaling (relative to canvas)
  x: z.number().min(0).max(1).default(0), // Position X (0-1 relative to canvas)
  y: z.number().min(0).max(1).default(0), // Position Y (0-1 relative to canvas)
  width: z.number().min(0.01).max(5).default(1), // Width scale factor
  height: z.number().min(0.01).max(5).default(1), // Height scale factor

  // For color/gradient backgrounds
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  gradient: GradientSchema.optional(),

  // Layer properties
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']).default('normal'),
  zIndex: z.number().min(1).max(100).default(1)
}).refine(data => {
  // Validation: if type is 'image', imageId is required
  if (data.type === 'image' && !data.imageId) {
    return false
  }
  // Validation: if type is 'color', color is required
  if (data.type === 'color' && !data.color) {
    return false
  }
  // Validation: if type is 'gradient', gradient is required
  if (data.type === 'gradient' && !data.gradient) {
    return false
  }
  return true
}, {
  message: "Required fields missing for the specified background type"
})

// Enhanced Slide Schema with Canvas and Background Layers
const RemixSlideSchema = z.object({
  id: z.string().optional(),
  displayOrder: z.number().min(0),

  // Canvas settings
  canvas: CanvasSizeSchema.default({
    width: 1080,
    height: 1920,
    unit: 'px'
  }),

  // Background layers (stacked from bottom to top)
  backgroundLayers: z.array(BackgroundLayerSchema).default([
    {
      type: 'color',
      color: '#ffffff',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      opacity: 1,
      blendMode: 'normal',
      zIndex: 1
    }
  ]),

  // Content tracking
  originalImageIndex: z.number().min(0),

  // AI-generated paraphrased content
  paraphrasedText: z.string().min(1).max(2000),
  originalText: z.string().optional(),

  // Additional manual text boxes
  textBoxes: z.array(RemixTextBoxSchema).default([])
})

// Complete Remix Schema
const RemixPostSchema = z.object({
  id: z.string().cuid().optional(),
  originalPostId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  generationType: z.enum(['manual', 'ai_paraphrase']).default('manual'),
  slides: z.array(RemixSlideSchema).default([])
})

// Schema for creating a new remix (request body validation)
const CreateRemixSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  options: z.object({
    theme: z.string().optional(),
    style: z.enum(['casual', 'professional', 'trendy', 'educational', 'humorous']).optional(),
    targetAudience: z.string().optional(),
    canvasSize: CanvasSizeSchema.optional()
  }).optional()
})

// Schema for updating an existing remix
const UpdateRemixSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  slides: z.array(RemixSlideSchema).optional()
})

// Generate remix options interface
export interface GenerateRemixOptions {
  theme?: string
  style?: 'casual' | 'professional' | 'trendy' | 'educational' | 'humorous'
  targetAudience?: string
}

// Export types
export type RemixPostType = z.infer<typeof RemixPostSchema>
export type RemixSlideType = z.infer<typeof RemixSlideSchema>
export type RemixTextBoxType = z.infer<typeof RemixTextBoxSchema>
export type CanvasSizeType = z.infer<typeof CanvasSizeSchema>
export type BackgroundLayerType = z.infer<typeof BackgroundLayerSchema>
export type GradientType = z.infer<typeof GradientSchema>

// Export validation schemas
export {
  RemixPostSchema,
  RemixSlideSchema,
  RemixTextBoxSchema,
  CanvasSizeSchema,
  BackgroundLayerSchema,
  GradientSchema,
  CreateRemixSchema,
  UpdateRemixSchema
}

// Utility functions for common canvas sizes
export const CANVAS_SIZES = {
  INSTAGRAM_STORY: { width: 1080, height: 1920, unit: 'px' as const },
  INSTAGRAM_POST: { width: 1080, height: 1080, unit: 'px' as const },
  INSTAGRAM_LANDSCAPE: { width: 1080, height: 566, unit: 'px' as const },
  FACEBOOK_POST: { width: 1200, height: 630, unit: 'px' as const },
  TWITTER_POST: { width: 1200, height: 675, unit: 'px' as const },
  LINKEDIN_POST: { width: 1200, height: 627, unit: 'px' as const },
  TIKTOK_VERTICAL: { width: 1080, height: 1920, unit: 'px' as const },
  CUSTOM: { width: 1080, height: 1920, unit: 'px' as const }
} as const

// Utility function to create default background layers
export function createDefaultBackgroundLayers(overrides?: Partial<BackgroundLayerType>): BackgroundLayerType[] {
  return [
    {
      id: `bg_${Date.now()}_1`,
      type: 'color',
      color: '#ffffff',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      opacity: 1,
      blendMode: 'normal',
      zIndex: 1,
      ...overrides
    } as BackgroundLayerType
  ]
}

// Utility function to create image background layer
export function createImageBackgroundLayer(
  imageId: string,
  overrides?: Partial<BackgroundLayerType>
): BackgroundLayerType {
  return {
    id: `bg_${Date.now()}_${Math.random()}`,
    type: 'image',
    imageId,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    opacity: 1,
    blendMode: 'normal',
    zIndex: 2,
    ...overrides
  }
}

// Utility function to create gradient background layer
export function createGradientBackgroundLayer(
  gradient: GradientType,
  overrides?: Partial<BackgroundLayerType>
): BackgroundLayerType {
  return {
    id: `bg_${Date.now()}_${Math.random()}`,
    type: 'gradient',
    gradient,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    opacity: 1,
    blendMode: 'normal',
    zIndex: 1,
    ...overrides
  } as BackgroundLayerType
}