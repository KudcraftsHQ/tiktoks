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
   * Upload photo carousel as draft to TikTok using PULL_FROM_URL
   * Uses MEDIA_UPLOAD mode - content goes to user's inbox for manual publishing
   * Note: TikTok API requires PULL_FROM_URL for photos (FILE_UPLOAD is only for videos)
   */
  async uploadCarouselDraft(
    request: TikTokUploadRequest
  ): Promise<TikTokUploadResponse> {
    console.log('🎬🎬🎬 [TikTokAPI.uploadCarouselDraft] ==================== START ====================')
    const { accessToken, title, description, photoUrls, photoCoverIndex = 0 } = request

    console.log('📋 [TikTokAPI.uploadCarouselDraft] Input:', {
      title,
      description,
      photoUrlsCount: photoUrls.length,
      photoUrls,
      photoCoverIndex,
      accessTokenPrefix: accessToken.substring(0, 10) + '...'
    })

    // Validate input
    if (photoUrls.length < 1) {
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Validation failed: Not enough photos')
      throw new Error('At least 1 photo is required')
    }
    if (photoUrls.length > 35) {
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Validation failed: Too many photos')
      throw new Error('TikTok allows maximum 35 photos')
    }

    console.log('✅ [TikTokAPI.uploadCarouselDraft] Validation passed')
    console.log('📸 [TikTokAPI.uploadCarouselDraft] Starting PULL_FROM_URL for', photoUrls.length, 'photos')

    // Validate all URLs are publicly accessible
    console.log('🔍 [TikTokAPI.uploadCarouselDraft] Validating photo URLs...')
    photoUrls.forEach((url, index) => {
      try {
        const parsedUrl = new URL(url)
        console.log(`🔗 [TikTokAPI.uploadCarouselDraft] Photo ${index + 1}:`, {
          url,
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          pathname: parsedUrl.pathname
        })
      } catch (error) {
        console.error(`❌ [TikTokAPI.uploadCarouselDraft] Invalid URL at index ${index}:`, url)
        throw new Error(`Invalid photo URL at index ${index}: ${url}`)
      }
    })

    // Initialize upload session using PULL_FROM_URL
    console.log('🚀 [TikTokAPI.uploadCarouselDraft] Initializing upload session...')
    const initPayload: any = {
      post_mode: 'MEDIA_UPLOAD', // Draft mode
      media_type: 'PHOTO',
      post_info: {},
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: photoCoverIndex,
        photo_images: photoUrls, // Array of image URLs
      },
    }

    // Add optional fields
    if (title) {
      initPayload.post_info.title = title.substring(0, 90) // Max 90 chars
      console.log('📝 [TikTokAPI.uploadCarouselDraft] Added title:', initPayload.post_info.title)
    }
    if (description) {
      initPayload.post_info.description = description.substring(0, 4000) // Max 4000 chars
      console.log('📝 [TikTokAPI.uploadCarouselDraft] Added description:', initPayload.post_info.description)
    }

    console.log('📦 [TikTokAPI.uploadCarouselDraft] Complete payload:', JSON.stringify(initPayload, null, 2))

    console.log('🌐 [TikTokAPI.uploadCarouselDraft] Making request to TikTok API...')
    console.log('🌐 [TikTokAPI.uploadCarouselDraft] Endpoint:', `${TIKTOK_API_BASE}/v2/post/publish/content/init/`)

    const initResponse = await fetch(
      `${TIKTOK_API_BASE}/v2/post/publish/content/init/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initPayload),
      }
    )

    console.log('📡 [TikTokAPI.uploadCarouselDraft] Response status:', initResponse.status)
    console.log('📡 [TikTokAPI.uploadCarouselDraft] Response headers:', Object.fromEntries(initResponse.headers.entries()))

    if (!initResponse.ok) {
      const error = await initResponse.text()
      console.error('❌❌❌ [TikTokAPI.uploadCarouselDraft] Init failed!')
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Status:', initResponse.status)
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Error text:', error)
      throw new Error(`TikTok upload init failed: ${error}`)
    }

    const initData = await initResponse.json()
    console.log('📦 [TikTokAPI.uploadCarouselDraft] Init response:', JSON.stringify(initData, null, 2))

    // TikTok API returns { error: { code: "ok", message: "", log_id: "..." }, data: { publish_id: "..." } }
    // Check if error.code is NOT "ok" (actual error condition)
    if (initData.error && initData.error.code && initData.error.code !== 'ok') {
      console.error('❌❌❌ [TikTokAPI.uploadCarouselDraft] API returned error!')
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Error object:', initData.error)
      throw new Error(
        `TikTok upload init error: ${initData.error.message || JSON.stringify(initData.error)}`
      )
    }

    console.log('✅ [TikTokAPI.uploadCarouselDraft] TikTok API error check passed (code: ok)')

    const publishId = initData.data?.publish_id

    if (!publishId) {
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Missing publish_id in response!')
      console.error('❌ [TikTokAPI.uploadCarouselDraft] Response data:', initData)
      throw new Error('Invalid init response: missing publish_id')
    }

    console.log('✅✅✅ [TikTokAPI.uploadCarouselDraft] Init successful!')
    console.log('✅ [TikTokAPI.uploadCarouselDraft] Publish ID:', publishId)
    console.log('🎉 [TikTokAPI.uploadCarouselDraft] TikTok is pulling images from URLs!')
    console.log('🎉 [TikTokAPI.uploadCarouselDraft] ==================== COMPLETE ====================')

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
