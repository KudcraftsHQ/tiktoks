import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { extractConceptsFromPosts } from '@/lib/concept-extraction-service'

const prisma = new PrismaClient()

// POST /api/concepts/extract - Extract concepts from selected posts
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { postIds } = body

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'postIds array is required' },
        { status: 400 }
      )
    }

    // Fetch posts with OCR data
    const posts = await prisma.tiktokPost.findMany({
      where: {
        id: { in: postIds },
        contentType: 'photo',
        ocrStatus: 'completed'
      },
      select: {
        id: true,
        description: true,
        ocrTexts: true,
        slideClassifications: true
      }
    })

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No valid posts found. Posts must be photo carousels with completed OCR.' },
        { status: 400 }
      )
    }

    // Extract concepts
    const result = await extractConceptsFromPosts(posts, 'EXTRACTED')

    return NextResponse.json({
      success: true,
      postsProcessed: posts.length,
      conceptsCreated: result.created,
      duplicatesSkipped: result.duplicates,
      concepts: result.concepts
    })
  } catch (error) {
    console.error('Failed to extract concepts:', error)
    return NextResponse.json(
      { error: 'Failed to extract concepts from posts' },
      { status: 500 }
    )
  }
}
