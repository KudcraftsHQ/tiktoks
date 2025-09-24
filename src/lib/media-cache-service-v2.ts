/**
 * Media Cache Service V2
 *
 * Enhanced media caching service using the new CacheAsset system with background processing
 */

import { cacheAssetService } from './cache-asset-service'
import { CacheAsset } from '@/generated/prisma'

class MediaCacheServiceV2 {

  /**
   * Cache a single image and return cache asset ID
   */
  async cacheImage(url: string, subfolder = 'images'): Promise<string | null> {
    if (!url) return null

    console.log(`🖼️ [MediaCacheServiceV2] Caching image: ${url}`)

    const cacheAsset = await cacheAssetService.createCacheAsset(
      url,
      `carousel/${subfolder}`
    )

    console.log(`✅ [MediaCacheServiceV2] Created cache asset for image: ${cacheAsset.id}`)
    return cacheAsset.id
  }

  /**
   * Cache a video and return cache asset ID
   */
  async cacheVideo(url: string, subfolder = 'videos'): Promise<string | null> {
    if (!url) return null

    console.log(`🎥 [MediaCacheServiceV2] Caching video: ${url}`)

    const cacheAsset = await cacheAssetService.createCacheAsset(
      url,
      `tiktok/${subfolder}`
    )

    console.log(`✅ [MediaCacheServiceV2] Created cache asset for video: ${cacheAsset.id}`)
    return cacheAsset.id
  }

  /**
   * Cache an avatar and return cache asset ID
   */
  async cacheAvatar(url: string, subfolder = 'avatars'): Promise<string | null> {
    if (!url) return null

    console.log(`👤 [MediaCacheServiceV2] Caching avatar: ${url}`)

    const cacheAsset = await cacheAssetService.createCacheAsset(
      url,
      `tiktok/${subfolder}`
    )

    console.log(`✅ [MediaCacheServiceV2] Created cache asset for avatar: ${cacheAsset.id}`)
    return cacheAsset.id
  }

  /**
   * Cache music/audio and return cache asset ID
   */
  async cacheMusic(url: string, subfolder = 'music'): Promise<string | null> {
    if (!url) return null

    console.log(`🎵 [MediaCacheServiceV2] Caching music: ${url}`)

    const cacheAsset = await cacheAssetService.createCacheAsset(
      url,
      `tiktok/${subfolder}`
    )

    console.log(`✅ [MediaCacheServiceV2] Created cache asset for music: ${cacheAsset.id}`)
    return cacheAsset.id
  }

  /**
   * Cache multiple images and return cache asset IDs
   */
  async cacheImages(urls: string[], subfolder = 'images'): Promise<(string | null)[]> {
    console.log(`🖼️ [MediaCacheServiceV2] Caching ${urls.length} images`)

    const validUrls = urls.filter(url => url && url.trim())
    if (validUrls.length === 0) return []

    const cacheAssets = await cacheAssetService.createBulkCacheAssets(
      validUrls,
      `carousel/${subfolder}`
    )

    // Map back to original order, including null for invalid URLs
    const cacheAssetIds = urls.map(url => {
      if (!url || !url.trim()) return null
      const cacheAsset = cacheAssets.find(asset => asset.originalUrl === url)
      return cacheAsset?.id || null
    })

    console.log(`✅ [MediaCacheServiceV2] Created cache assets for ${cacheAssets.length} images`)
    return cacheAssetIds
  }

  /**
   * Cache all media from a carousel and return cache asset IDs
   */
  async cacheCarouselMedia(
    images: Array<{ imageUrl: string; width?: number; height?: number }>,
    authorAvatar?: string
  ): Promise<{
    cachedImages: Array<{ cacheAssetId: string | null; width?: number; height?: number }>
    cachedAuthorAvatarId?: string | null
    errors: string[]
  }> {
    console.log(`📸 [MediaCacheServiceV2] Caching carousel media: ${images.length} images`)

    const errors: string[] = []

    // Cache carousel images
    const imageUrls = images.map(img => img.imageUrl)
    const imageCacheAssetIds = await this.cacheImages(imageUrls, 'images')

    const cachedImages = images.map((originalImage, index) => ({
      cacheAssetId: imageCacheAssetIds[index],
      width: originalImage.width,
      height: originalImage.height
    }))

    // Cache author avatar
    let cachedAuthorAvatarId: string | null = null
    if (authorAvatar) {
      try {
        cachedAuthorAvatarId = await this.cacheAvatar(authorAvatar)
      } catch (error) {
        errors.push(`Failed to cache author avatar: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      cachedImages,
      cachedAuthorAvatarId,
      errors
    }
  }

  /**
   * Cache all media from a TikTok post and return cache asset IDs
   */
  async cacheTikTokPostMedia(
    videoUrl?: string,
    coverUrl?: string,
    musicUrl?: string,
    images?: Array<{ url: string; width: number; height: number }>,
    authorAvatar?: string
  ): Promise<{
    cachedVideoId?: string | null
    cachedCoverId?: string | null
    cachedMusicId?: string | null
    cachedImages: Array<{ cacheAssetId: string | null; width: number; height: number }>
    cachedAuthorAvatarId?: string | null
    errors: string[]
  }> {
    console.log(`🎬 [MediaCacheServiceV2] Caching TikTok post media`)

    const errors: string[] = []
    const cachedImages: Array<{ cacheAssetId: string | null; width: number; height: number }> = []

    // Cache video
    let cachedVideoId: string | null = null
    if (videoUrl) {
      try {
        cachedVideoId = await this.cacheVideo(videoUrl, 'videos')
      } catch (error) {
        errors.push(`Failed to cache video: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Cache cover image
    let cachedCoverId: string | null = null
    if (coverUrl) {
      try {
        cachedCoverId = await this.cacheImage(coverUrl, 'covers')
      } catch (error) {
        errors.push(`Failed to cache cover: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Cache music
    let cachedMusicId: string | null = null
    if (musicUrl) {
      try {
        cachedMusicId = await this.cacheMusic(musicUrl)
      } catch (error) {
        errors.push(`Failed to cache music: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Cache carousel images (for photo posts)
    if (images && images.length > 0) {
      const imageUrls = images.map(img => img.url)
      const imageCacheAssetIds = await this.cacheImages(imageUrls, 'images')

      images.forEach((originalImage, index) => {
        cachedImages.push({
          cacheAssetId: imageCacheAssetIds[index],
          width: originalImage.width,
          height: originalImage.height
        })
      })
    }

    // Cache author avatar
    let cachedAuthorAvatarId: string | null = null
    if (authorAvatar) {
      try {
        cachedAuthorAvatarId = await this.cacheAvatar(authorAvatar)
      } catch (error) {
        errors.push(`Failed to cache author avatar: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      cachedVideoId,
      cachedCoverId,
      cachedMusicId,
      cachedImages,
      cachedAuthorAvatarId,
      errors
    }
  }

  /**
   * Get URL using the cache asset service (convenience method)
   */
  async getUrl(cacheAssetIdOrKey: string | null | undefined, originalUrl?: string): Promise<string> {
    return cacheAssetService.getUrl(cacheAssetIdOrKey, originalUrl)
  }

  /**
   * Get multiple URLs using the cache asset service (convenience method)
   */
  async getUrls(
    cacheAssetIdsOrKeys: (string | null | undefined)[],
    originalUrls?: (string | undefined)[]
  ): Promise<string[]> {
    return cacheAssetService.getUrls(cacheAssetIdsOrKeys, originalUrls)
  }
}

// Export singleton instance
export const mediaCacheServiceV2 = new MediaCacheServiceV2()
export default MediaCacheServiceV2