/**
 * Shared type definitions for Remix Posts
 * This file consolidates RemixPost-related types used across the application
 */

export interface DraftSession {
  id: string
  name: string
  generationStrategy: string
  languageStyle: string
  contentIdeas?: string | null
  slidesRange: { min: number; max: number }
  productContextId?: string | null
  createdAt: string
  updatedAt: string
  draftCount?: number
  productContext?: ProductContext
}

export interface DraftSessionWithData extends DraftSession {
  drafts: RemixPost[]
  referencePosts: any[]
}

export interface RemixPost {
  id: string
  name: string
  description?: string
  generationType: string
  sourcePostIds: string[]
  languageStyleTags: string[]
  isDraft: boolean
  bookmarked?: boolean
  isApproved?: boolean
  postedUrl?: string | null
  sessionId?: string | null
  session?: DraftSession
  createdAt: string
  updatedAt?: string
  canvasSize?: CanvasSettings
  slides: RemixSlide[]
  slideClassifications?: SlideClassification[]
  productContext?: ProductContext
  originalPost?: OriginalPost
  stats?: RemixStats
}

export interface RemixSlide {
  id: string
  displayOrder: number
  canvas?: CanvasSettings
  backgroundLayers?: BackgroundLayer[]
  originalImageIndex?: number
  paraphrasedText: string
  originalText?: string
  textBoxes?: TextBox[]
  viewport?: Viewport
}

export interface SlideClassification {
  slideIndex: number
  type: string
  categoryName: string
}

export interface ProductContext {
  id: string
  title: string
  description?: string
}

export interface OriginalPost {
  id: string
  tiktokUrl?: string
  authorNickname?: string | null
  authorHandle?: string | null
  description?: string | null
  images?: Array<{ cacheAssetId: string; width: number; height: number; url?: string }>
}

export interface RemixStats {
  avgLikes?: number | bigint | null
  avgComments?: number | bigint | null
  avgShares?: number | bigint | null
  avgViews?: number | bigint | null
  avgEngagementRate?: number | null
  totalSourcePosts?: number
  carouselCount?: number
}

export interface CanvasSettings {
  width: number
  height: number
  unit?: string
}

export interface BackgroundLayer {
  id?: string
  type: 'image' | 'color' | 'gradient'
  cacheAssetId?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fitMode: string
  color?: string
  opacity: number
  blendMode: string
  zIndex: number
  gradient?: {
    type: 'linear' | 'radial'
    colors: string[]
    angle?: number
    centerX?: number
    centerY?: number
  }
}

export interface TextBox {
  id?: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  color: string
  textAlign: string
  zIndex: number
  textWrap?: string
  textStroke?: string
  textShadow?: string
  borderWidth?: number
  borderColor?: string
  enableShadow?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  outlineWidth?: number
  outlineColor?: string
  backgroundColor?: string
  backgroundOpacity?: number
  borderRadius?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  lineHeight?: number
  letterSpacing?: number
  wordSpacing?: number
  transform?: Transform
  lockAspectRatio?: boolean
}

export interface Viewport {
  zoom: number
  offsetX: number
  offsetY: number
}

export interface Transform {
  rotation: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
}
