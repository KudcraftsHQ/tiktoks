/**
 * Media Download Service
 *
 * Downloads media from URLs with browser-like headers to avoid detection
 * Supports images, videos, and other media types
 */

interface DownloadOptions {
  timeout?: number
  retries?: number
  headers?: Record<string, string>
}

interface DownloadResult {
  buffer: Buffer
  contentType: string
  size: number
  filename?: string
}

class MediaDownloadService {
  private defaultHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  }

  async download(
    url: string,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    const {
      timeout = 30000, // 30 seconds default
      retries = 3,
      headers = {}
    } = options

    const mergedHeaders = { ...this.defaultHeaders, ...headers }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          method: 'GET',
          headers: mergedHeaders,
          signal: controller.signal,
          redirect: 'follow'
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Get content type from response headers or fallback
        const contentType = response.headers.get('content-type') || 'application/octet-stream'

        // Get content length
        const contentLength = response.headers.get('content-length')
        const size = contentLength ? parseInt(contentLength, 10) : 0

        // Download the file as buffer
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Extract filename from URL if possible
        const filename = this.extractFilename(url, contentType)

        return {
          buffer,
          contentType,
          size: buffer.length,
          filename
        }
      } catch (error) {
        if (attempt === retries) {
          throw new Error(`Failed to download ${url} after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))

        console.warn(`Download attempt ${attempt} failed for ${url}, retrying in ${delay}ms...`)
      }
    }

    throw new Error('Unexpected error in download loop')
  }

  private extractFilename(url: string, contentType: string): string | undefined {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname

      // Extract filename from URL path
      let filename = pathname.split('/').pop()

      if (filename && filename.includes('.')) {
        return filename
      }

      // Generate filename based on content type
      const extension = this.getExtensionFromContentType(contentType)
      if (extension) {
        return `media_${Date.now()}.${extension}`
      }

      return undefined
    } catch {
      return undefined
    }
  }

  private getExtensionFromContentType(contentType: string): string | undefined {
    const typeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'weba'
    }

    const baseType = contentType.split(';')[0].trim().toLowerCase()
    return typeMap[baseType]
  }

  async downloadMultiple(
    urls: string[],
    options: DownloadOptions = {}
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = []

    // Download with concurrency limit to avoid overwhelming servers
    const concurrencyLimit = 3
    const chunks = this.chunkArray(urls, concurrencyLimit)

    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        try {
          const result = await this.download(url, options)
          return { url, result, error: null }
        } catch (error) {
          console.error(`Failed to download ${url}:`, error)
          return { url, result: null, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      const chunkResults = await Promise.all(promises)

      for (const { url, result, error } of chunkResults) {
        if (result) {
          results.push(result)
        } else {
          console.error(`Skipping failed download: ${url} - ${error}`)
        }
      }
    }

    return results
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  async getFileInfo(url: string): Promise<{
    contentType: string
    size: number
    exists: boolean
  }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: this.defaultHeaders
      })

      if (!response.ok) {
        return { contentType: '', size: 0, exists: false }
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const contentLength = response.headers.get('content-length')
      const size = contentLength ? parseInt(contentLength, 10) : 0

      return { contentType, size, exists: true }
    } catch {
      return { contentType: '', size: 0, exists: false }
    }
  }
}

export const mediaDownloadService = new MediaDownloadService()
export default MediaDownloadService