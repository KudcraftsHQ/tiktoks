import { NextRequest, NextResponse } from 'next/server'
import { tiktokAPIService } from '@/lib/tiktok-api-service'

/**
 * POST /api/tiktok-accounts/oauth/url
 * Generate TikTok OAuth authorization URL
 */
export async function POST(request: NextRequest) {
  try {
    // Validate credentials are present
    if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET || !process.env.TIKTOK_REDIRECT_URI) {
      console.error('❌ [OAuth URL] TikTok credentials not configured!')
      return NextResponse.json(
        { error: 'TikTok API credentials not configured. Please check your environment variables.' },
        { status: 500 }
      )
    }

    // Generate CSRF state token
    const state = Math.random().toString(36).substring(2, 15)

    // Get authorization URL
    const authUrl = tiktokAPIService.getAuthorizationUrl(state)

    return NextResponse.json({
      url: authUrl,
      state,
    })
  } catch (error) {
    console.error('Failed to generate TikTok auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}
