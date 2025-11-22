import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { z } from 'zod'

const prisma = new PrismaClient()

const BatchCreateProjectsSchema = z.object({
  postIds: z.array(z.string().min(1)).min(1, 'At least one post ID is required')
})

/**
 * Creates one project per post ID provided.
 * Each project is named after the post's author handle and gets the post as its single reference.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postIds } = BatchCreateProjectsSchema.parse(body)

    // Fetch all posts to get their details for project naming
    const posts = await prisma.tiktokPost.findMany({
      where: { id: { in: postIds } },
      select: {
        id: true,
        authorHandle: true,
        description: true,
        contentType: true
      }
    })

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No valid posts found' },
        { status: 404 }
      )
    }

    // Create a map for quick lookup
    const postMap = new Map(posts.map(p => [p.id, p]))

    // Generate unique project names
    const existingProjectNames = await prisma.project.findMany({
      select: { name: true }
    })
    const existingNamesSet = new Set(existingProjectNames.map(p => p.name.toLowerCase()))

    const generateUniqueName = (baseName: string): string => {
      let name = baseName
      let counter = 1
      while (existingNamesSet.has(name.toLowerCase())) {
        name = `${baseName} (${counter})`
        counter++
      }
      existingNamesSet.add(name.toLowerCase()) // Add to set for next iteration
      return name
    }

    // Create projects in a transaction
    const createdProjects = await prisma.$transaction(async (tx) => {
      const projects = []

      for (const postId of postIds) {
        const post = postMap.get(postId)
        if (!post) continue

        // Generate project name from post details
        const shortDesc = post.description
          ? post.description.slice(0, 50) + (post.description.length > 50 ? '...' : '')
          : 'Untitled'
        const baseName = `@${post.authorHandle || 'unknown'} - ${shortDesc}`
        const projectName = generateUniqueName(baseName.slice(0, 100)) // Max 100 chars

        // Create project
        const project = await tx.project.create({
          data: {
            name: projectName,
            description: `Reference: ${post.contentType} post by @${post.authorHandle || 'unknown'}`
          }
        })

        // Add the post to the project
        await tx.projectPost.create({
          data: {
            projectId: project.id,
            postId: postId
          }
        })

        projects.push({
          ...project,
          postId
        })
      }

      return projects
    })

    return NextResponse.json({
      success: true,
      projects: createdProjects,
      count: createdProjects.length,
      message: `Created ${createdProjects.length} project${createdProjects.length !== 1 ? 's' : ''}`
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to batch create projects:', error)
    return NextResponse.json(
      { error: 'Failed to create projects' },
      { status: 500 }
    )
  }
}
