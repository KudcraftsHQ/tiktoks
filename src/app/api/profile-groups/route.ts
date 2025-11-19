import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

// GET /api/profile-groups - List all profile groups
export async function GET(request: NextRequest) {
  try {
    const groups = await prisma.profileGroup.findMany({
      include: {
        _count: {
          select: { profiles: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        profileCount: group._count.profiles,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }))
    })
  } catch (error) {
    console.error('Failed to fetch profile groups:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile groups' },
      { status: 500 }
    )
  }
}

// POST /api/profile-groups - Create a new profile group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Group name is required' },
        { status: 400 }
      )
    }

    // Check if group with this name already exists
    const existing = await prisma.profileGroup.findUnique({
      where: { name: name.trim() }
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A group with this name already exists' },
        { status: 409 }
      )
    }

    const group = await prisma.profileGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    })

    return NextResponse.json({
      success: true,
      data: group
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create profile group:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create profile group' },
      { status: 500 }
    )
  }
}
