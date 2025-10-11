import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tiktokAPIService } from '@/lib/tiktok-api-service'

/**
 * POST /api/tiktok-accounts/callback
 * Handle OAuth callback and save account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, state } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const tokenData = await tiktokAPIService.exchangeCodeForToken(code)

    // Fetch user info to get username, display name, and avatar
    let userInfo
    try {
      userInfo = await tiktokAPIService.getUserInfo(tokenData.access_token)
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      // Continue without user info if it fails
      userInfo = null
    }

    // Check if account already exists
    const existingAccount = await prisma.tiktokUploadAccount.findUnique({
      where: { openId: tokenData.open_id },
    })

    const accountData = {
      openId: tokenData.open_id,
      username: userInfo?.username || null,
      displayName: userInfo?.display_name || null,
      avatarUrl: userInfo?.avatar_url || null,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      refreshExpiresAt: new Date(
        Date.now() + tokenData.refresh_expires_in * 1000
      ),
      scope: tokenData.scope,
      status: 'ACTIVE' as const,
    }

    let account
    if (existingAccount) {
      // Update existing account
      account = await prisma.tiktokUploadAccount.update({
        where: { id: existingAccount.id },
        data: accountData,
      })
    } else {
      // Create new account
      account = await prisma.tiktokUploadAccount.create({
        data: accountData,
      })
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        openId: account.openId,
        displayName: account.displayName,
      },
    })
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process OAuth callback',
      },
      { status: 500 }
    )
  }
}
