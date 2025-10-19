/**
 * TikTok URL Parser Utility
 * Validates and extracts TikTok video IDs from various URL formats
 */

/**
 * Validates if a string is a valid TikTok URL
 * @param url - The URL to validate
 * @returns true if the URL is a valid TikTok URL
 */
export function isValidTikTokUrl(url: string): boolean {
  if (!url) return false

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Accept tiktok.com, www.tiktok.com, vm.tiktok.com, vt.tiktok.com
    const validHosts = ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']

    return validHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

/**
 * Extracts TikTok video ID from a URL
 * Supports formats:
 * - https://www.tiktok.com/@username/video/1234567890
 * - https://www.tiktok.com/@username/photo/1234567890
 * - https://vm.tiktok.com/ABC123/
 * - https://vt.tiktok.com/ABC123/
 * @param url - The TikTok URL
 * @returns The video ID or null if not found
 */
export function extractTikTokId(url: string): string | null {
  if (!isValidTikTokUrl(url)) return null

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Format: /@username/video/1234567890 or /@username/photo/1234567890
    const videoMatch = pathname.match(/\/(video|photo)\/(\d+)/)
    if (videoMatch) {
      return videoMatch[2]
    }

    // For short URLs (vm.tiktok.com, vt.tiktok.com), we can't extract the actual ID
    // These will need to be matched by the full URL in the database
    return null
  } catch {
    return null
  }
}

/**
 * Normalizes a TikTok URL to a standard format
 * @param url - The TikTok URL to normalize
 * @returns Normalized URL or the original URL if it can't be normalized
 */
export function normalizeTikTokUrl(url: string): string {
  if (!isValidTikTokUrl(url)) return url

  try {
    const urlObj = new URL(url)

    // Remove query parameters and hash
    urlObj.search = ''
    urlObj.hash = ''

    // Normalize /photo/ to /video/ (TikTok uses both for the same content)
    let normalized = urlObj.toString().replace('/photo/', '/video/')

    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }

    return normalized
  } catch {
    return url
  }
}

/**
 * Result type for TikTok URL parsing
 */
export interface TikTokUrlParseResult {
  isValid: boolean
  videoId: string | null
  normalizedUrl: string
  originalUrl: string
}

/**
 * Parses a TikTok URL and returns all extracted information
 * @param url - The TikTok URL to parse
 * @returns Parse result with validation status and extracted data
 */
export function parseTikTokUrl(url: string): TikTokUrlParseResult {
  const isValid = isValidTikTokUrl(url)
  const videoId = isValid ? extractTikTokId(url) : null
  const normalizedUrl = isValid ? normalizeTikTokUrl(url) : url

  return {
    isValid,
    videoId,
    normalizedUrl,
    originalUrl: url
  }
}
