import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/tiktok-accounts
 * List all connected TikTok upload accounts
 */
export async function GET(request: NextRequest) {
  try {
    const accounts = await prisma.tiktokUploadAccount.findMany({
      orderBy: {
        connectedAt: 'desc',
      },
      select: {
        id: true,
        openId: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        connectedAt: true,
        lastUsedAt: true,
        tokenExpiresAt: true,
      },
    })

    // Check and update expired accounts
    const now = new Date()
    const accountsWithStatus = accounts.map((account) => ({
      ...account,
      isExpired: account.tokenExpiresAt < now,
    }))

    return NextResponse.json({ accounts: accountsWithStatus })
  } catch (error) {
    console.error('Failed to fetch TikTok accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}
