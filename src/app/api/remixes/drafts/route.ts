import { NextRequest, NextResponse } from 'next/server'
import { getDraftRemixes } from '@/lib/multi-post-generation-service'

/**
 * GET /api/remixes/drafts
 * Get all draft remixes with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '25', 10)
    const generationType = searchParams.get('generationType') || undefined
    const searchQuery = searchParams.get('search') || undefined

    const result = await getDraftRemixes(page, limit, {
      generationType,
      searchQuery
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch drafts:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch drafts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
