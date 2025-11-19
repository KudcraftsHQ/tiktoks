import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const AddDraftsToProjectSchema = z.object({
  draftIds: z.array(z.string().min(1)).min(1, 'At least one draft ID is required')
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Fetch project with all remixes (drafts)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        remixes: {
          select: {
            id: true,
            name: true,
            description: true,
            slides: true,
            slideClassifications: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'asc' // Oldest first to match the UI
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Return drafts with formatted data for Canva app
    const drafts = project.remixes.map(remix => {
      const slidesArray = Array.isArray(remix.slides) ? remix.slides : []
      const slides = slidesArray.map((slide: any, index: number) => {
        // Get slide classification if available
        const classifications = Array.isArray(remix.slideClassifications)
          ? remix.slideClassifications
          : []
        const classification = classifications.find((c: any) => c.slideIndex === index) as { type?: string } | undefined

        return {
          slideIndex: index,
          text: slide.paraphrasedText || '',
          type: (classification?.type as string) || 'unknown'
        }
      })

      return {
        id: remix.id,
        name: remix.name,
        description: remix.description,
        slideCount: slidesArray.length,
        slides,
        createdAt: remix.createdAt,
        updatedAt: remix.updatedAt,
      }
    })

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      drafts,
    })
  } catch (error) {
    console.error('Failed to fetch drafts for Canva app:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { draftIds } = AddDraftsToProjectSchema.parse(body)

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check if all drafts exist
    const drafts = await prisma.remixPost.findMany({
      where: { id: { in: draftIds } }
    })

    if (drafts.length !== draftIds.length) {
      const foundIds = drafts.map(d => d.id)
      const missingIds = draftIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        { error: `Drafts not found: ${missingIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Check which remixes (drafts) are already in the project
    const existingRemixes = await prisma.remixPost.findMany({
      where: {
        projectId,
        id: { in: draftIds }
      }
    })

    const existingRemixIds = existingRemixes.map(r => r.id)
    const newRemixIds = draftIds.filter(id => !existingRemixIds.includes(id))

    // Update remixes to associate with project
    const results = {
      added: 0,
      skipped: existingRemixIds.length,
      errors: 0
    }

    if (newRemixIds.length > 0) {
      // Update each remix to set the projectId
      const updates = await Promise.all(
        newRemixIds.map(id =>
          prisma.remixPost.update({
            where: { id },
            data: { projectId }
          })
        )
      )
      results.added = updates.length
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Added ${results.added} draft(s). ${results.skipped > 0 ? `Skipped ${results.skipped} duplicate(s).` : ''}`
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to add drafts to project:', error)
    return NextResponse.json(
      { error: 'Failed to add drafts to project' },
      { status: 500 }
    )
  }
}
