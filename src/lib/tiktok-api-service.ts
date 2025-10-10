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

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TikTok token exchange failed: ${error}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(
        `TikTok token exchange error: ${data.error.message || data.error}`
      )
    }

    return data.data as TikTokOAuthTokenResponse
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<TikTokOAuthTokenResponse> {
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

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TikTok token refresh failed: ${error}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(
        `TikTok token refresh error: ${data.error.message || data.error}`
      )
    }

    return data.data as TikTokOAuthTokenResponse
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
   * Upload photo carousel as draft to TikTok
   * Uses MEDIA_UPLOAD mode - content goes to user's inbox for manual publishing
   */
  async uploadCarouselDraft(
    request: TikTokUploadRequest
  ): Promise<TikTokUploadResponse> {
    const { accessToken, title, description, photoUrls, photoCoverIndex = 0 } = request

    // Validate input
    if (photoUrls.length < 2) {
      throw new Error('TikTok requires at least 2 photos for carousel')
    }
    if (photoUrls.length > 35) {
      throw new Error('TikTok allows maximum 35 photos for carousel')
    }

    const payload: any = {
      post_mode: 'MEDIA_UPLOAD', // Draft mode
      media_type: 'PHOTO',
      post_info: {},
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: photoUrls,
        photo_cover_index: photoCoverIndex,
      },
    }

    // Add optional fields
    if (title) {
      payload.post_info.title = title.substring(0, 90) // Max 90 chars
    }
    if (description) {
      payload.post_info.description = description.substring(0, 4000) // Max 4000 chars
    }

    const response = await fetch(
      `${TIKTOK_API_BASE}/v2/post/publish/content/init/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TikTok upload failed: ${error}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(
        `TikTok upload error: ${data.error.message || JSON.stringify(data.error)}`
      )
    }

    return {
      publish_id: data.data?.publish_id || '',
      error: data.error,
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
