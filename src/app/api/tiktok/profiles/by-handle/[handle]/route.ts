import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { cacheAssetService } from '@/lib/cache-asset-service'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const cleanHandle = handle.replace('@', '') // Remove @ prefix if present

    const profile = await prisma.tiktokProfile.findUnique({
      where: { handle: cleanHandle },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Generate presigned URL for avatar
    console.log(`🔗 [API] Generating presigned URL for profile ${profile.id} avatar`)
    const avatarUrl = await cacheAssetService.getUrl(profile.avatarId)
    console.log(`✅ [API] Avatar URL resolved:`, {
      avatarId: profile.avatarId,
      resolvedUrl: avatarUrl
    })

    const profileWithPresignedAvatar = {
      ...profile,
      avatar: avatarUrl,
      // Serialize BigInt fields to strings for JSON
      totalViews: profile.totalViews?.toString() || '0',
      totalLikes: profile.totalLikes?.toString() || '0',
      totalShares: profile.totalShares?.toString() || '0',
      totalComments: profile.totalComments?.toString() || '0',
      totalSaves: profile.totalSaves?.toString() || '0'
    }

    return NextResponse.json(profileWithPresignedAvatar)
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
