import { NextRequest, NextResponse } from 'next/server'
import { tiktokAPIService } from '@/lib/tiktok-api-service'

/**
 * POST /api/tiktok-accounts/oauth/url
 * Generate TikTok OAuth authorization URL
 */
export async function POST(request: NextRequest) {
  try {
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
