/**
 * TikTok API Service
 * Handles OAuth authentication and content posting to TikTok
 */

const TIKTOK_API_BASE = 'https://open.tiktokapis.com'
const TIKTOK_AUTH_BASE = 'https://www.tiktok.com'

export interface TikTokOAuthTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds (typically 86400 = 24 hours)
  refresh_expires_in: number // seconds (typically 31536000 = 1 year)
  open_id: string
  scope: string
  token_type: 'Bearer'
}

export interface TikTokUploadRequest {
  accessToken: string
  title?: string
  description?: string
  photoUrls: string[] // Array of publicly accessible image URLs
  photoCoverIndex?: number // Index of photo to use as cover (default: 0)
}

export interface TikTokUploadResponse {
  publish_id: string
  error?: {
    code: string
    message: string
  }
}

export interface TikTokUserInfo {
  open_id: string
  union_id: string
  avatar_url: string
  avatar_url_100: string
  avatar_url_200: string
  avatar_large_url: string
  display_name: string
  bio_description: string
  profile_deep_link: string
  is_verified: boolean
  follower_count: number
  following_count: number
  likes_count: number
  video_count: number
  username: string
}

export class TikTokAPIService {
  private clientKey: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientKey = process.env.TIKTOK_CLIENT_KEY || ''
    this.clientSecret = process.env.TIKTOK_CLIENT_SECRET || ''
    this.redirectUri = process.env.TIKTOK_REDIRECT_URI || ''

    if (!this.clientKey || !this.clientSecret || !this.redirectUri) {
      console.warn(
        'TikTok API credentials not configured. Please set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI in environment variables.'
      )
    }
  }

  /**
   * Generate TikTok OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const csrfState = state || this.generateState()
    const scope = 'video.upload' // For MEDIA_UPLOAD mode

    const params = new URLSearchParams({
      client_key: this.clientKey,
      scope: scope,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: csrfState,
    })

    return `${TIKTOK_AUTH_BASE}/v2/auth/authorize/?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TikTokOAuthTokenResponse> {
    console.log('🔄 [Token Exchange] Starting token exchange...')

    const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    })

    console.log('📡 [Token Exchange] Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ [Token Exchange] Failed:', error)
      throw new Error(`TikTok token exchange failed: ${error}`)
    }

    const data = await response.json()
    console.log('📦 [Token Exchange] Response data:', JSON.stringify(data, null, 2))

    if (data.error) {
      console.error('❌ [Token Exchange] API error:', data.error)
      throw new Error(
        `TikTok token exchange error: ${data.error.message || data.error}`
      )
    }

    // Validate required fields
    if (!data.access_token || !data.open_id) {
      console.error('❌ [Token Exchange] Missing required fields in response:', data)
      throw new Error(
        `Invalid TikTok API response: missing required token fields. Response: ${JSON.stringify(data)}`
      )
    }

    console.log('✅ [Token Exchange] Success - open_id:', data.open_id)
    return data as TikTokOAuthTokenResponse
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<TikTokOAuthTokenResponse> {
    console.log('🔄 [Token Refresh] Starting token refresh...')

    const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    console.log('📡 [Token Refresh] Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ [Token Refresh] Failed:', error)
      throw new Error(`TikTok token refresh failed: ${error}`)
    }

    const data = await response.json()
    console.log('📦 [Token Refresh] Response data:', JSON.stringify(data, null, 2))

    if (data.error) {
      console.error('❌ [Token Refresh] API error:', data.error)
      throw new Error(
        `TikTok token refresh error: ${data.error.message || data.error}`
      )
    }

    // Validate required fields
    if (!data.access_token || !data.open_id) {
      console.error('❌ [Token Refresh] Missing required fields in response:', data)
      throw new Error(
        `Invalid TikTok API response: missing required token fields. Response: ${JSON.stringify(data)}`
      )
    }

    console.log('✅ [Token Refresh] Success - open_id:', data.open_id)
    return data as TikTokOAuthTokenResponse
  }

  /**
   * Revoke an access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/revoke/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        token: accessToken,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TikTok token revocation failed: ${error}`)
    }
  }

  /**
   * Get user info from TikTok API
   * Fetches username, display name, avatar, and other profile details
   */
  async getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
    console.log('👤 [User Info] Fetching user info...')

    const response = await fetch(`${TIKTOK_API_BASE}/v2/user/info/?fields=open_id,union_id,avatar_url,avatar_url_100,avatar_url_200,avatar_large_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count,username`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('📡 [User Info] Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ [User Info] Failed:', error)
      throw new Error(`TikTok user info fetch failed: ${error}`)
    }

    const result = await response.json()
    console.log('📦 [User Info] Response data:', JSON.stringify(result, null, 2))

    if (result.error) {
      console.error('❌ [User Info] API error:', result.error)
      throw new Error(
        `TikTok user info error: ${result.error.message || result.error}`
      )
    }

    if (!result.data || !result.data.user) {
      console.error('❌ [User Info] Invalid response structure:', result)
      throw new Error('Invalid TikTok user info response')
    }

    console.log('✅ [User Info] Success - username:', result.data.user.username)
    return result.data.user as TikTokUserInfo
  }

  /**
   * Upload photo carousel as draft to TikTok using FILE_UPLOAD
   * Uses MEDIA_UPLOAD mode - content goes to user's inbox for manual publishing
   */
  async uploadCarouselDraft(
    request: TikTokUploadRequest
  ): Promise<TikTokUploadResponse> {
    const { accessToken, title, description, photoUrls, photoCoverIndex = 0 } = request

    // Validate input
    if (photoUrls.length < 1) {
      throw new Error('At least 1 photo is required')
    }
    if (photoUrls.length > 35) {
      throw new Error('TikTok allows maximum 35 photos')
    }

    console.log('📸 [Photo Upload] Starting FILE_UPLOAD for', photoUrls.length, 'photos')

    // Step 1: Download all images from URLs
    const imageBlobs: Blob[] = []
    for (let i = 0; i < photoUrls.length; i++) {
      console.log(`📥 [Photo Upload] Downloading image ${i + 1}/${photoUrls.length}`)
      const imageResponse = await fetch(photoUrls[i])
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image ${i + 1}: ${imageResponse.statusText}`)
      }
      const blob = await imageResponse.blob()
      imageBlobs.push(blob)
      console.log(`✅ [Photo Upload] Downloaded image ${i + 1} (${blob.size} bytes)`)
    }

    // Step 2: Initialize upload session
    console.log('🚀 [Photo Upload] Initializing upload session...')
    const initPayload: any = {
      post_mode: 'MEDIA_UPLOAD', // Draft mode
      media_type: 'PHOTO',
      post_info: {},
      source_info: {
        source: 'FILE_UPLOAD',
        photo_cover_index: photoCoverIndex,
      },
    }

    // Add optional fields
    if (title) {
      initPayload.post_info.title = title.substring(0, 90) // Max 90 chars
    }
    if (description) {
      initPayload.post_info.description = description.substring(0, 4000) // Max 4000 chars
    }

    const initResponse = await fetch(
      `${TIKTOK_API_BASE}/v2/post/publish/inbox/photo/init/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initPayload),
      }
    )

    if (!initResponse.ok) {
      const error = await initResponse.text()
      console.error('❌ [Photo Upload] Init failed:', error)
      throw new Error(`TikTok upload init failed: ${error}`)
    }

    const initData = await initResponse.json()
    console.log('📦 [Photo Upload] Init response:', JSON.stringify(initData, null, 2))

    if (initData.error) {
      throw new Error(
        `TikTok upload init error: ${initData.error.message || JSON.stringify(initData.error)}`
      )
    }

    const publishId = initData.data?.publish_id
    const uploadUrls = initData.data?.upload_url as string[]

    if (!publishId || !uploadUrls || uploadUrls.length !== imageBlobs.length) {
      throw new Error('Invalid init response: missing publish_id or upload_urls')
    }

    console.log('✅ [Photo Upload] Init successful - publish_id:', publishId)
    console.log('📤 [Photo Upload] Got', uploadUrls.length, 'upload URLs')

    // Step 3: Upload each image to its respective URL
    for (let i = 0; i < imageBlobs.length; i++) {
      console.log(`⬆️ [Photo Upload] Uploading image ${i + 1}/${imageBlobs.length} to TikTok...`)
      
      const uploadResponse = await fetch(uploadUrls[i], {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': imageBlobs[i].size.toString(),
        },
        body: imageBlobs[i],
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text()
        console.error(`❌ [Photo Upload] Upload failed for image ${i + 1}:`, error)
        throw new Error(`Failed to upload image ${i + 1}: ${uploadResponse.statusText}`)
      }

      console.log(`✅ [Photo Upload] Image ${i + 1} uploaded successfully`)
    }

    console.log('🎉 [Photo Upload] All images uploaded successfully!')

    return {
      publish_id: publishId,
    }
  }

  /**
   * Generate a random state string for CSRF protection
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
  }
}

// Export singleton instance
export const tiktokAPIService = new TikTokAPIService()
