import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tiktokAPIService } from '@/lib/tiktok-api-service'

/**
 * DELETE /api/tiktok-accounts/[id]
 * Remove a connected TikTok account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get account to revoke token
    const account = await prisma.tiktokUploadAccount.findUnique({
      where: { id },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Try to revoke the token (don't fail if this errors)
    try {
      await tiktokAPIService.revokeToken(account.accessToken)
    } catch (error) {
      console.warn('Failed to revoke TikTok token:', error)
      // Continue with deletion even if revocation fails
    }

    // Delete account from database
    await prisma.tiktokUploadAccount.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete TikTok account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
