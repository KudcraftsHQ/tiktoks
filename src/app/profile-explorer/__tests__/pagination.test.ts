/**
 * Unit tests for Profile Explorer pagination logic
 * Tests cursor-based pagination implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

interface ProfileVideosResult {
  posts: any[]
  hasMore: boolean
  maxCursor?: string
  minCursor?: string
}

// Simulate the fetch logic from the page component
async function fetchProfileVideos(
  handle: string,
  cursor?: string,
  isLoadMore = false
): Promise<{
  posts: any[]
  maxCursor?: string
  hasMore: boolean
  error?: string
}> {
  try {
    const params = new URLSearchParams({
      handle: handle.startsWith('@') ? handle.slice(1) : handle,
      trim: 'true'
    })

    if (cursor) {
      params.append('max_cursor', cursor)
    }

    const response = await fetch(`/api/tiktok/profile/videos?${params.toString()}`)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch profile videos')
    }

    const data: ProfileVideosResult = result.data

    return {
      posts: data.posts,
      maxCursor: data.maxCursor,
      hasMore: data.hasMore
    }
  } catch (err) {
    return {
      posts: [],
      hasMore: false,
      error: err instanceof Error ? err.message : 'An error occurred'
    }
  }
}

describe('Profile Explorer Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch initial posts without cursor', async () => {
    const mockResponse = {
      success: true,
      data: {
        posts: Array(10).fill(null).map((_, i) => ({
          id: `post-${i}`,
          tiktokId: `${1000 + i}`,
          title: `Post ${i}`
        })),
        hasMore: true,
        maxCursor: 'cursor-page-2',
        minCursor: 'cursor-page-1'
      }
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await fetchProfileVideos('ava.goviral')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('handle=ava.goviral')
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining('max_cursor')
    )
    expect(result.posts).toHaveLength(10)
    expect(result.hasMore).toBe(true)
    expect(result.maxCursor).toBe('cursor-page-2')
  })

  it('should fetch next page with cursor', async () => {
    const mockResponse = {
      success: true,
      data: {
        posts: Array(10).fill(null).map((_, i) => ({
          id: `post-${i + 10}`,
          tiktokId: `${1010 + i}`,
          title: `Post ${i + 10}`
        })),
        hasMore: true,
        maxCursor: 'cursor-page-3',
        minCursor: 'cursor-page-2'
      }
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await fetchProfileVideos('ava.goviral', 'cursor-page-2', true)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('max_cursor=cursor-page-2')
    )
    expect(result.posts).toHaveLength(10)
    expect(result.hasMore).toBe(true)
    expect(result.maxCursor).toBe('cursor-page-3')
  })

  it('should handle last page with hasMore=false', async () => {
    const mockResponse = {
      success: true,
      data: {
        posts: Array(5).fill(null).map((_, i) => ({
          id: `post-${i + 20}`,
          tiktokId: `${1020 + i}`,
          title: `Post ${i + 20}`
        })),
        hasMore: false,
        maxCursor: undefined,
        minCursor: 'cursor-page-3'
      }
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await fetchProfileVideos('ava.goviral', 'cursor-page-3', true)

    expect(result.posts).toHaveLength(5)
    expect(result.hasMore).toBe(false)
    expect(result.maxCursor).toBeUndefined()
  })

  it('should simulate full pagination flow (3 pages)', async () => {
    let allPosts: any[] = []

    // Page 1
    const page1Response = {
      success: true,
      data: {
        posts: Array(10).fill(null).map((_, i) => ({ id: `post-${i}` })),
        hasMore: true,
        maxCursor: 'cursor-2'
      }
    }

    // Page 2
    const page2Response = {
      success: true,
      data: {
        posts: Array(10).fill(null).map((_, i) => ({ id: `post-${i + 10}` })),
        hasMore: true,
        maxCursor: 'cursor-3'
      }
    }

    // Page 3 (last page)
    const page3Response = {
      success: true,
      data: {
        posts: Array(5).fill(null).map((_, i) => ({ id: `post-${i + 20}` })),
        hasMore: false,
        maxCursor: undefined
      }
    }

    // Fetch page 1
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => page1Response
    })

    const result1 = await fetchProfileVideos('ava.goviral')
    allPosts = [...result1.posts]

    expect(allPosts).toHaveLength(10)
    expect(result1.hasMore).toBe(true)

    // Fetch page 2
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => page2Response
    })

    const result2 = await fetchProfileVideos('ava.goviral', result1.maxCursor, true)
    allPosts = [...allPosts, ...result2.posts]

    expect(allPosts).toHaveLength(20)
    expect(result2.hasMore).toBe(true)

    // Fetch page 3
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => page3Response
    })

    const result3 = await fetchProfileVideos('ava.goviral', result2.maxCursor, true)
    allPosts = [...allPosts, ...result3.posts]

    expect(allPosts).toHaveLength(25)
    expect(result3.hasMore).toBe(false)

    // Verify all posts are unique
    const uniqueIds = new Set(allPosts.map(p => p.id))
    expect(uniqueIds.size).toBe(25)
  })

  it('should handle errors gracefully', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Profile not found' })
    })

    const result = await fetchProfileVideos('nonexistent.user')

    expect(result.posts).toHaveLength(0)
    expect(result.hasMore).toBe(false)
    expect(result.error).toBe('Profile not found')
  })

  it('should strip @ from handle', async () => {
    const mockResponse = {
      success: true,
      data: {
        posts: [],
        hasMore: false
      }
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await fetchProfileVideos('@ava.goviral')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('handle=ava.goviral')
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining('handle=@')
    )
  })
})

describe('Profile Explorer UI State Management', () => {
  it('should correctly determine when to show Load More button', () => {
    // Simulate component state logic
    const shouldShowLoadMore = (
      currentHandle: string,
      maxCursor: string | undefined,
      hasMore: boolean,
      loading: boolean
    ) => {
      return hasMore && currentHandle && maxCursor && !loading
    }

    // Should show Load More
    expect(shouldShowLoadMore('ava.goviral', 'cursor-2', true, false)).toBe(true)

    // Should NOT show Load More (no more posts)
    expect(shouldShowLoadMore('ava.goviral', 'cursor-2', false, false)).toBe(false)

    // Should NOT show Load More (no cursor)
    expect(shouldShowLoadMore('ava.goviral', undefined, true, false)).toBe(false)

    // Should NOT show Load More (loading)
    expect(shouldShowLoadMore('ava.goviral', 'cursor-2', true, true)).toBe(false)

    // Should NOT show Load More (no handle)
    expect(shouldShowLoadMore('', 'cursor-2', true, false)).toBe(false)
  })

  it('should disable Load More when filter is active', () => {
    const shouldDisableLoadMore = (
      contentTypeFilter: 'all' | 'video' | 'photo'
    ) => {
      return contentTypeFilter !== 'all'
    }

    expect(shouldDisableLoadMore('all')).toBe(false)
    expect(shouldDisableLoadMore('video')).toBe(true)
    expect(shouldDisableLoadMore('photo')).toBe(true)
  })
})
