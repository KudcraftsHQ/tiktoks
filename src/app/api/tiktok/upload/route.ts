import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tiktokAPIService } from '@/lib/tiktok-api-service'
import { cacheAssetService } from '@/lib/cache-asset-service'

interface UploadRequest {
  accountId: string
  title?: string
  description?: string
  photoIds: string[] // CacheAsset IDs
}

/**
 * POST /api/tiktok/upload
 * Upload carousel photos as draft to TikTok
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UploadRequest
    const { accountId, title, description, photoIds } = body

    // Validate input
    if (!accountId || !photoIds || photoIds.length === 0) {
      return NextResponse.json(
        { error: 'Account ID and photos are required' },
        { status: 400 }
      )
    }

    if (photoIds.length < 1) {
      return NextResponse.json(
        { error: 'At least 1 photo is required' },
        { status: 400 }
      )
    }

    if (photoIds.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 photos allowed' },
        { status: 400 }
      )
    }

    // Get account
    const account = await prisma.tiktokUploadAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Check if token is expired
    const now = new Date()
    let accessToken = account.accessToken

    if (account.tokenExpiresAt < now) {
      // Try to refresh token
      try {
        const tokenData = await tiktokAPIService.refreshAccessToken(
          account.refreshToken
        )

        // Update account with new tokens
        await prisma.tiktokUploadAccount.update({
          where: { id: accountId },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
            refreshExpiresAt: new Date(
              Date.now() + tokenData.refresh_expires_in * 1000
            ),
            status: 'ACTIVE',
          },
        })

        accessToken = tokenData.access_token
      } catch (error) {
        console.error('Failed to refresh token:', error)
        // Mark account as expired
        await prisma.tiktokUploadAccount.update({
          where: { id: accountId },
          data: { status: 'EXPIRED' },
        })

        return NextResponse.json(
          { error: 'Account token expired. Please reconnect your account.' },
          { status: 401 }
        )
      }
    }

    // Get image URLs from cache assets (using PULL_FROM_URL method)
    // Use public URLs (not presigned) for TikTok domain verification
    console.log('📸 [TikTok Upload] Fetching image URLs from cache assets...')
    const photoUrls = await cacheAssetService.getUrls(photoIds, undefined, true) // preferPublic = true

    if (photoUrls.length !== photoIds.length) {
      return NextResponse.json(
        { error: 'Failed to resolve all image URLs' },
        { status: 500 }
      )
    }

    console.log('📸 [TikTok Upload] Resolved', photoUrls.length, 'public image URLs')

    // Upload to TikTok using PULL_FROM_URL (TikTok will fetch images from URLs)
    const uploadResult = await tiktokAPIService.uploadCarouselDraft({
      accessToken,
      title,
      description,
      photoUrls,
    })

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500 }
      )
    }

    // Update last used time
    await prisma.tiktokUploadAccount.update({
      where: { id: accountId },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      publishId: uploadResult.publish_id,
      message:
        'Carousel uploaded as draft! Check your TikTok inbox to complete and publish.',
    })
  } catch (error) {
    console.error('Upload to TikTok failed:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload to TikTok',
      },
      { status: 500 }
    )
  }
}
