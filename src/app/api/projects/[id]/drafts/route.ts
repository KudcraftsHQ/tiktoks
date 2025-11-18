import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

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
