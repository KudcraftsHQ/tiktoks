import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive' as const
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive' as const
          }
        }
      ]
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: {
              posts: true,
              remixes: true
            }
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { updatedAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.project.count({ where })
    ])

    const hasMore = skip + limit < total

    return NextResponse.json({
      projects,
      hasMore,
      total,
      page,
      limit
    })
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateProjectSchema.parse(body)

    // Check if a project with the same name already exists
    const existingProject = await prisma.project.findFirst({
      where: {
        name: {
          equals: validatedData.name,
          mode: 'insensitive'
        }
      }
    })

    if (existingProject) {
      return NextResponse.json(
        { error: 'A project with this name already exists' },
        { status: 400 }
      )
    }

    // Auto-select product context if only one exists
    const productContexts = await prisma.productContext.findMany()
    const productContextId = productContexts.length === 1 ? productContexts[0].id : null

    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        productContextId
      },
      include: {
        productContext: {
          select: {
            id: true,
            title: true,
            description: true
          }
        },
        _count: {
          select: {
            posts: true,
            remixes: true
          }
        }
      }
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to create project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}