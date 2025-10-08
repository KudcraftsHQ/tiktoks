import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { isOwnProfile } = await request.json()

    if (typeof isOwnProfile !== 'boolean') {
      return NextResponse.json(
        { error: 'isOwnProfile must be a boolean' },
        { status: 400 }
      )
    }

    const profile = await prisma.tiktokProfile.update({
      where: { id },
      data: { isOwnProfile }
    })

    // Convert BigInt fields to strings for JSON serialization
    const serializedProfile = {
      ...profile,
      totalViews: profile.totalViews?.toString() || '0',
      totalLikes: profile.totalLikes?.toString() || '0',
      totalShares: profile.totalShares?.toString() || '0',
      totalComments: profile.totalComments?.toString() || '0',
      totalSaves: profile.totalSaves?.toString() || '0'
    }

    return NextResponse.json({
      profile: serializedProfile,
      message: isOwnProfile ? 'Profile marked as own' : 'Profile unmarked as own'
    })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
