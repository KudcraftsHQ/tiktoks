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

    return NextResponse.json({
      profile,
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
