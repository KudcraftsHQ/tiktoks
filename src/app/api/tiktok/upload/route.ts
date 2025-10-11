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
    console.log('🚀 [TikTok Upload API] ==================== START ====================')
    const body = (await request.json()) as UploadRequest
    const { accountId, title, description, photoIds } = body

    console.log('📋 [TikTok Upload API] Request body:', {
      accountId,
      title,
      description,
      photoIds,
      photoIdsCount: photoIds?.length
    })

    // Validate input
    if (!accountId || !photoIds || photoIds.length === 0) {
      console.log('❌ [TikTok Upload API] Validation failed: Missing accountId or photoIds')
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
    console.log('🔍 [TikTok Upload API] Fetching TikTok account:', accountId)
    const account = await prisma.tiktokUploadAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      console.log('❌ [TikTok Upload API] Account not found:', accountId)
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    console.log('✅ [TikTok Upload API] Account found:', {
      id: account.id,
      username: account.username,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt
    })

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
    console.log('📸 [TikTok Upload API] ==================== FETCHING URLS ====================')
    console.log('📸 [TikTok Upload API] Photo IDs to resolve:', photoIds)
    console.log('📸 [TikTok Upload API] preferPublic: true (for custom domain)')

    const photoUrls = await cacheAssetService.getUrls(photoIds, undefined, true) // preferPublic = true

    console.log('📸 [TikTok Upload API] ==================== URLS RESOLVED ====================')
    console.log('📸 [TikTok Upload API] Resolved URLs count:', photoUrls.length)
    console.log('📸 [TikTok Upload API] Resolved URLs:', photoUrls)

    // Check each URL format
    photoUrls.forEach((url, index) => {
      const domain = new URL(url).hostname
      console.log(`📸 [TikTok Upload API] URL ${index + 1}:`, {
        url,
        domain,
        isCustomDomain: domain === 'srbfarm-assets.kudcrafts.com',
        isR2Domain: domain.includes('r2.cloudflarestorage.com')
      })
    })

    if (photoUrls.length !== photoIds.length) {
      console.log('❌ [TikTok Upload API] URL count mismatch!', {
        expected: photoIds.length,
        received: photoUrls.length
      })
      return NextResponse.json(
        { error: 'Failed to resolve all image URLs' },
        { status: 500 }
      )
    }

    console.log('✅ [TikTok Upload API] All URLs resolved successfully')

    // Upload to TikTok using PULL_FROM_URL (TikTok will fetch images from URLs)
    console.log('🎬 [TikTok Upload API] ==================== UPLOADING TO TIKTOK ====================')
    console.log('🎬 [TikTok Upload API] Upload params:', {
      title,
      description,
      photoUrlsCount: photoUrls.length,
      photoUrls: photoUrls
    })

    const uploadResult = await tiktokAPIService.uploadCarouselDraft({
      accessToken,
      title,
      description,
      photoUrls,
    })

    console.log('🎬 [TikTok Upload API] Upload result:', uploadResult)

    if (uploadResult.error) {
      console.log('❌ [TikTok Upload API] Upload failed with error:', uploadResult.error)
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500 }
      )
    }

    console.log('✅ [TikTok Upload API] Upload successful! Publish ID:', uploadResult.publish_id)

    // Update last used time
    await prisma.tiktokUploadAccount.update({
      where: { id: accountId },
      data: { lastUsedAt: new Date() },
    })

    console.log('🎉 [TikTok Upload API] ==================== SUCCESS ====================')
    return NextResponse.json({
      success: true,
      publishId: uploadResult.publish_id,
      message:
        'Carousel uploaded as draft! Check your TikTok inbox to complete and publish.',
    })
  } catch (error) {
    console.error('❌❌❌ [TikTok Upload API] ==================== ERROR ====================')
    console.error('❌ [TikTok Upload API] Error details:', error)
    console.error('❌ [TikTok Upload API] Error stack:', error instanceof Error ? error.stack : 'N/A')
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
