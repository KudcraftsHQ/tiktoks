import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// Helper function to serialize BigInt values to strings recursively
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key])
    }
    return serialized
  }

  return obj
}

// PATCH /api/tiktok/profiles/[id]/group - Update profile's group
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { groupId } = body
    const { id } = await params

    // Validate profile exists
    const profile = await prisma.tiktokProfile.findUnique({
      where: { id }
    })

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    // If groupId is provided, validate it exists
    if (groupId !== null && groupId !== undefined) {
      const group = await prisma.profileGroup.findUnique({
        where: { id: groupId }
      })

      if (!group) {
        return NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        )
      }
    }

    // Update profile's group
    const updatedProfile = await prisma.tiktokProfile.update({
      where: { id },
      data: {
        profileGroupId: groupId === null ? null : groupId
      },
      include: {
        profileGroup: true
      }
    })

    return NextResponse.json({
      success: true,
      data: serializeBigInt(updatedProfile)
    })
  } catch (error) {
    console.error('Failed to update profile group:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update profile group' },
      { status: 500 }
    )
  }
}
