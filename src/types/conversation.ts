/**
 * Conversation system types for AI chat with data feature
 */

export type GeminiModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-thinking"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-flash-lite-thinking"
  | "gemini-2.5-pro"
  | "gemini-2.5-pro-thinking"

export interface Message {
  id?: string // Optional unique ID for client-side use
  role: "user" | "assistant"
  content: string
  thinking?: string // For thinking models
  model: GeminiModel
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: string
}

export interface Conversation {
  id: string
  title: string | null
  selectedPostIds: string[]
  messages: Message[]
  currentModel: GeminiModel
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  createdAt: string
  updatedAt: string
}

/**
 * Model pricing information per 1 million tokens
 */
export interface ModelPricing {
  model: GeminiModel
  inputCostPerMillionTokens: number // USD
  outputCostPerMillionTokens: number // USD
  contextWindow: number // tokens
  displayName: string
  hasThinking: boolean
}

/**
 * Request payload for analyze endpoint
 */
export interface AnalyzeRequest {
  conversationId?: string | null
  postIds: string[]
  prompt: string
  model: GeminiModel
}

/**
 * Stream event types
 */
export type StreamEventType =
  | { type: "chunk"; content: string }
  | { type: "thinking"; content: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; cost: number }
  | { type: "conversationId"; id: string }
  | { type: "done" }
