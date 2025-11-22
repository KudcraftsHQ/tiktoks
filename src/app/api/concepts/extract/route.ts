import { NextResponse } from 'next/server'
import { extractConceptsFromPosts } from '@/lib/concept-extraction-service'

// POST /api/concepts/extract - Extract concepts from posts
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

    const result = await extractConceptsFromPosts(postIds)

    return NextResponse.json({
      success: true,
      conceptsCreated: result.conceptsCreated,
      examplesAdded: result.examplesAdded,
      errors: result.errors
    })
  } catch (error) {
    console.error('Failed to extract concepts:', error)
    return NextResponse.json(
      { error: 'Failed to extract concepts' },
      { status: 500 }
    )
  }
}
