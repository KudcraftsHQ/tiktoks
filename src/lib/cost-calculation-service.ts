/**
 * Cost calculation service for Gemini models
 * Handles token cost calculations and context window tracking
 */

import { GeminiModel, ModelPricing } from "@/types/conversation"

/**
 * Model pricing and configuration (2025 rates)
 * Prices are per 1 million tokens in USD
 * Note: Thinking tokens are included in output token costs
 */
const MODEL_PRICING: Record<GeminiModel, ModelPricing> = {
  "gemini-2.5-flash": {
    model: "gemini-2.5-flash",
    inputCostPerMillionTokens: 0.3,
    outputCostPerMillionTokens: 2.5,
    contextWindow: 1000000,
    displayName: "Gemini 2.5 Flash",
    hasThinking: false,
  },
  "gemini-2.5-flash-thinking": {
    model: "gemini-2.5-flash-thinking",
    inputCostPerMillionTokens: 0.3,
    outputCostPerMillionTokens: 2.5,
    contextWindow: 1000000,
    displayName: "Gemini 2.5 Flash (Thinking)",
    hasThinking: true,
  },
  "gemini-2.5-flash-lite": {
    model: "gemini-2.5-flash-lite",
    inputCostPerMillionTokens: 0.1,
    outputCostPerMillionTokens: 0.4,
    contextWindow: 1000000,
    displayName: "Gemini 2.5 Flash Lite",
    hasThinking: false,
  },
  "gemini-2.5-flash-lite-thinking": {
    model: "gemini-2.5-flash-lite-thinking",
    inputCostPerMillionTokens: 0.1,
    outputCostPerMillionTokens: 0.4,
    contextWindow: 1000000,
    displayName: "Gemini 2.5 Flash Lite (Thinking)",
    hasThinking: true,
  },
  "gemini-2.5-pro": {
    model: "gemini-2.5-pro",
    inputCostPerMillionTokens: 1.25,
    outputCostPerMillionTokens: 10.0,
    contextWindow: 1000000,
    displayName: "Gemini 2.5 Pro",
    hasThinking: false,
  },
  "gemini-2.5-pro-thinking": {
    model: "gemini-2.5-pro-thinking",
    inputCostPerMillionTokens: 1.25,
    outputCostPerMillionTokens: 10.0,
    contextWindow: 1000000,
    displayName: "Gemini 2.5 Pro (Thinking)",
    hasThinking: true,
  },
}

/**
 * Calculate cost for a message based on token usage
 * @param model - The Gemini model used
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  model: GeminiModel,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`)
  }

  const inputCost = (inputTokens / 1000000) * pricing.inputCostPerMillionTokens
  const outputCost =
    (outputTokens / 1000000) * pricing.outputCostPerMillionTokens

  return inputCost + outputCost
}

/**
 * Get context usage percentage
 * @param inputTokens - Current input tokens used
 * @param model - The model (determines context window)
 * @returns Percentage of context window used (0-100)
 */
export function getContextPercentage(
  inputTokens: number,
  model: GeminiModel
): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`)
  }

  const percentage = (inputTokens / pricing.contextWindow) * 100
  return Math.min(Math.max(percentage, 0), 100) // Clamp to 0-100
}

/**
 * Get display name for a model
 * @param model - The model
 * @returns Human-readable model name
 */
export function getModelDisplayName(model: GeminiModel): string {
  return MODEL_PRICING[model]?.displayName || model
}

/**
 * Check if model supports thinking mode
 * @param model - The model
 * @returns True if model supports thinking
 */
export function hasThinkingSupport(model: GeminiModel): boolean {
  return MODEL_PRICING[model]?.hasThinking || false
}

/**
 * Get all available models
 * @returns Array of model options with pricing info
 */
export function getAllModels(): ModelPricing[] {
  return Object.values(MODEL_PRICING)
}

/**
 * Format cost for display
 * @param cost - Cost in USD
 * @returns Formatted cost string
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return "$0.00"
  }

  // For very small costs, show in scientific notation
  if (cost < 0.0001) {
    return `$${cost.toExponential(2)}`
  }

  return `$${cost.toFixed(4)}`
}

/**
 * Format token count for display
 * @param tokens - Number of tokens
 * @returns Formatted token string
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  }

  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }

  return tokens.toString()
}

/**
 * Get context window for a model
 * @param model - The model
 * @returns Context window size in tokens
 */
export function getContextWindow(model: GeminiModel): number {
  return MODEL_PRICING[model]?.contextWindow || 1000000
}
