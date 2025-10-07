/**
 * Utility function to get the best URL for an image
 * Checks for cached R2 URLs first, falls back to proxy for TikTok CDN URLs
 */
export async function getImageUrl(originalUrl: string): Promise<string> {
  if (!originalUrl) return ''

  // If it's already an R2 URL or presigned URL, return as-is
  if (isR2Url(originalUrl) || isPresignedUrl(originalUrl)) {
    return originalUrl
  }

  // Check if it's a TikTok CDN URL that might have a cached version
  if (isTikTokCdnUrl(originalUrl)) {
    // Check for cached version via API
    try {
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      const response = await fetch(`${baseUrl}/api/images/cached?url=${encodeURIComponent(originalUrl)}`)
      const data = await response.json()

      if (data.cached && data.resolvedUrl && data.resolvedUrl !== originalUrl) {
        console.log('✅ Using cached URL:', data.resolvedUrl)
        return data.resolvedUrl
      }
    } catch (error) {
      console.warn('Failed to check cached image:', error)
    }

    // Fall back to proxy for TikTok CDN URLs
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return `${baseUrl}/api/images/proxy?url=${encodeURIComponent(originalUrl)}`
  }

  // Return original URL for non-TikTok images
  return originalUrl
}

/**
 * Get stable proxy URL using cache asset ID
 * This ensures the URL never changes, even when the underlying source changes from TikTok CDN → R2
 */
export function getProxiedImageUrlById(cacheAssetId: string | null | undefined): string {
  if (!cacheAssetId) return ''

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return `${baseUrl}/api/images/proxy?id=${encodeURIComponent(cacheAssetId)}`
}

/**
 * Synchronous version for client-side components (uses proxy by default)
 * This handles HEIC conversion and Content-Disposition issues
 * @deprecated Use getProxiedImageUrlById for stable caching
 */
export function getProxiedImageUrl(originalUrl: string): string {
  if (!originalUrl) return ''

  // If it's an R2 URL, return as-is (already cached and converted)
  if (isR2Url(originalUrl)) {
    return originalUrl
  }

  // If it's a presigned URL and HEIC, proxy it for conversion
  if (isPresignedUrl(originalUrl) && isHeicUrl(originalUrl)) {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return `${baseUrl}/api/images/proxy?url=${encodeURIComponent(originalUrl)}`
  }

  // If it's a presigned URL but not HEIC, return as-is
  if (isPresignedUrl(originalUrl)) {
    return originalUrl
  }

  // Check if it's a TikTok CDN URL that might need proxying
  if (isTikTokCdnUrl(originalUrl)) {
    // Create proxy URL for TikTok CDN URLs
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return `${baseUrl}/api/images/proxy?url=${encodeURIComponent(originalUrl)}`
  }

  // Return original URL for non-TikTok images
  return originalUrl
}

/**
 * Check if an image URL is likely to be a HEIC format
 */
export function isHeicUrl(url: string): boolean {
  return url.toLowerCase().includes('.heic') || url.toLowerCase().includes('.heif')
}

/**
 * Check if an image URL is from TikTok CDN
 */
export function isTikTokCdnUrl(url: string): boolean {
  const tiktokDomains = ['tiktokcdn.com', 'tiktokcdn-us.com', 'bytedance.com']
  return tiktokDomains.some(domain => url.includes(domain))
}

/**
 * Check if URL is an R2 URL
 */
export function isR2Url(url: string): boolean {
  // Check for R2 domains or custom domain
  return url.includes('r2.dev') || url.includes('cloudflare.com') ||
         // Add your custom R2 domain here if you have one
         (process.env.R2_CUSTOM_DOMAIN && url.includes(process.env.R2_CUSTOM_DOMAIN))
}

/**
 * Check if URL is a presigned URL (has query params with signatures)
 */
export function isPresignedUrl(url: string): boolean {
  return url.includes('X-Amz-Signature') || url.includes('x-amz-signature') ||
         url.includes('Signature=') || url.includes('signature=')
}