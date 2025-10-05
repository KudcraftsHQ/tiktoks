import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileExplorerPage from '../page'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn()
  }),
  usePathname: () => '/profile-explorer',
  useSearchParams: () => new URLSearchParams()
}))

// Mock Lucide icons using partial mock to keep real icons
const MockIcon = ({ className, 'data-testid': testId }: { className?: string; 'data-testid'?: string }) => (
  <div data-testid={testId} className={className} />
)

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return {
    ...actual,
    RefreshCw: (props: any) => <MockIcon {...props} data-testid="refresh-icon" />,
    Database: (props: any) => <MockIcon {...props} data-testid="database-icon" />,
    ChevronDown: (props: any) => <MockIcon {...props} data-testid="chevron-down-icon" />,
    Search: (props: any) => <MockIcon {...props} data-testid="search-icon" />,
    Loader2: (props: any) => <MockIcon {...props} data-testid="loader-icon" />,
    Grid3X3: (props: any) => <MockIcon {...props} data-testid="grid-icon" />,
    Video: (props: any) => <MockIcon {...props} data-testid="video-icon" />,
    Image: (props: any) => <MockIcon {...props} data-testid="image-icon" />,
    ArrowUpDown: (props: any) => <MockIcon {...props} data-testid="arrow-up-down-icon" />
  }
})

// Helper to create mock post data
function createMockPost(id: string, overrides = {}) {
  return {
    id,
    tiktokId: id,
    tiktokUrl: `https://www.tiktok.com/@testuser/video/${id}`,
    contentType: 'video',
    title: `Test Post ${id}`,
    description: `Description for post ${id}`,
    authorNickname: 'Test User',
    authorHandle: 'testuser',
    authorAvatar: 'https://example.com/avatar.jpg',
    hashtags: [{ text: '#test', url: 'https://www.tiktok.com/tag/test' }],
    mentions: [],
    viewCount: 1000,
    likeCount: 100,
    shareCount: 10,
    commentCount: 5,
    saveCount: 2,
    videoUrl: `https://example.com/video-${id}.mp4`,
    coverUrl: `https://example.com/cover-${id}.jpg`,
    images: [],
    publishedAt: new Date().toISOString(),
    ...overrides
  }
}

// Helper to create mock API response
function createMockApiResponse(postIds: string[], hasMore = false, maxCursor?: string) {
  return {
    data: {
      posts: postIds.map(id => createMockPost(id)),
      hasMore,
      maxCursor,
      minCursor: '1000000000'
    },
    upsertResult: {
      stats: {
        postsCreated: postIds.length,
        postsUpdated: 0,
        totalPosts: postIds.length
      }
    }
  }
}

// Helper to get the visible input (avoids duplicate element issues)
function getInput() {
  return screen.getAllByPlaceholderText(/Enter TikTok handle/i)[0]
}

// Helper to get the visible explore button
function getExploreButton() {
  return screen.getAllByRole('button', { name: /explore/i })[0]
}

describe('ProfileExplorerPage - Load More Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial Page Load', () => {
    it('should render without crashing', () => {
      render(<ProfileExplorerPage />)
      const inputs = screen.getAllByPlaceholderText(/Enter TikTok handle/i)
      expect(inputs.length).toBeGreaterThan(0)
    })

    it('should not show Load More button initially', () => {
      render(<ProfileExplorerPage />)
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    })
  })

  describe('First Page Fetch', () => {
    it('should fetch and display posts when handle is submitted', async () => {
      const user = userEvent.setup()

      // Mock first page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2', 'post3'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      // Enter handle and submit
      await user.type(getInput(), '@testuser')
      await user.click(getExploreButton())

      // Wait for posts to appear
      await waitFor(() => {
        expect(screen.getByText(/Posts from @testuser/i)).toBeInTheDocument()
      })

      // Verify API was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tiktok/profile/videos?handle=testuser&trim=true')
      )

      // Verify posts are displayed
      expect(screen.getByText('Test Post post1')).toBeInTheDocument()
      expect(screen.getByText('Test Post post2')).toBeInTheDocument()
      expect(screen.getByText('Test Post post3')).toBeInTheDocument()
    })

    it('should show Load More button when hasMore is true', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })
    })

    it('should not show Load More button when hasMore is false', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2'], false)
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText(/Posts from @testuser/i)).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    })

    it('should handle @ prefix in handle correctly', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1'], false)
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Verify @ was stripped
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('handle=testuser')
      )
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('handle=%40testuser')
      )
    })
  })

  describe('Load More Functionality', () => {
    it('should load second page when Load More is clicked', async () => {
      const user = userEvent.setup()

      // Mock first page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2', 'post3'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })

      // Mock second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post4', 'post5', 'post6'], true, 'cursor-page3')
      })

      // Click Load More
      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText('Test Post post4')).toBeInTheDocument()
      })

      // Verify API was called with cursor
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('max_cursor=cursor-page2')
      )

      // Verify all posts are displayed (first + second page)
      expect(screen.getByText('Test Post post1')).toBeInTheDocument()
      expect(screen.getByText('Test Post post2')).toBeInTheDocument()
      expect(screen.getByText('Test Post post3')).toBeInTheDocument()
      expect(screen.getByText('Test Post post4')).toBeInTheDocument()
      expect(screen.getByText('Test Post post5')).toBeInTheDocument()
      expect(screen.getByText('Test Post post6')).toBeInTheDocument()
    })

    it('should load multiple pages sequentially', async () => {
      const user = userEvent.setup()

      // Mock page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })

      // Mock page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post3', 'post4'], true, 'cursor-page3')
      })

      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText('Test Post post3')).toBeInTheDocument()
      })

      // Mock page 3
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post5', 'post6'], false) // No more pages
      })

      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText('Test Post post5')).toBeInTheDocument()
      })

      // Verify Load More button is hidden
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()

      // Verify all 6 posts are displayed
      expect(screen.getByText('Test Post post1')).toBeInTheDocument()
      expect(screen.getByText('Test Post post2')).toBeInTheDocument()
      expect(screen.getByText('Test Post post3')).toBeInTheDocument()
      expect(screen.getByText('Test Post post4')).toBeInTheDocument()
      expect(screen.getByText('Test Post post5')).toBeInTheDocument()
      expect(screen.getByText('Test Post post6')).toBeInTheDocument()
    })

    it('should update post count when loading more', async () => {
      const user = userEvent.setup()

      // Mock page 1: 3 posts
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2', 'post3'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText(/Posts from @testuser \(3 of 3\)/i)).toBeInTheDocument()
      })

      // Mock page 2: 2 more posts
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post4', 'post5'], false)
      })

      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText(/Posts from @testuser \(5 of 5\)/i)).toBeInTheDocument()
      })
    })

    it('should show loading state while loading more', async () => {
      const user = userEvent.setup()

      // Mock page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })

      // Mock page 2 with delay
      mockFetch.mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => createMockApiResponse(['post3', 'post4'], false)
          }), 100)
        )
      )

      await user.click(screen.getByRole('button', { name: /load more/i }))

      // Load More button should be disabled while loading
      const loadMoreButton = screen.getByRole('button', { name: /load more/i })
      expect(loadMoreButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.getByText('Test Post post3')).toBeInTheDocument()
      })
    })

    it('should not allow multiple simultaneous Load More requests', async () => {
      const user = userEvent.setup()

      // Mock page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })

      // Mock page 2 with delay
      mockFetch.mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => createMockApiResponse(['post3', 'post4'], false)
          }), 100)
        )
      )

      // Click Load More multiple times rapidly
      const loadMoreButton = screen.getByRole('button', { name: /load more/i })
      await user.click(loadMoreButton)
      await user.click(loadMoreButton)
      await user.click(loadMoreButton)

      // Wait for request to complete
      await waitFor(() => {
        expect(screen.getByText('Test Post post3')).toBeInTheDocument()
      })

      // Only 2 API calls should have been made (initial + 1 load more)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should display error message when initial fetch fails', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'User not found' })
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@nonexistentuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    })

    it('should preserve existing posts when Load More fails', async () => {
      const user = userEvent.setup()

      // Mock successful page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2', 'post3'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText('Test Post post1')).toBeInTheDocument()
      })

      // Mock failed page 2
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API rate limit exceeded' })
      })

      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument()
      })

      // Original posts should still be visible
      expect(screen.getByText('Test Post post1')).toBeInTheDocument()
      expect(screen.getByText('Test Post post2')).toBeInTheDocument()
      expect(screen.getByText('Test Post post3')).toBeInTheDocument()
    })
  })

  describe('Content Type Filter Interaction', () => {
    it('should disable Load More when filter is active', async () => {
      const user = userEvent.setup()

      // Mock page with mixed content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            posts: [
              createMockPost('post1', { contentType: 'video' }),
              createMockPost('post2', { contentType: 'photo' }),
              createMockPost('post3', { contentType: 'video' })
            ],
            hasMore: true,
            maxCursor: 'cursor-page2'
          }
        })
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })

      // Change filter to "Video only"
      const filterButton = screen.getByRole('button', { name: /all posts/i })
      await user.click(filterButton)

      const videoOption = screen.getByRole('menuitem', { name: /video only/i })
      await user.click(videoOption)

      // Load More should be disabled
      const loadMoreButton = screen.getByRole('button', { name: /load more/i })
      expect(loadMoreButton).toBeDisabled()
    })

    it('should show correct filtered count', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            posts: [
              createMockPost('post1', { contentType: 'video' }),
              createMockPost('post2', { contentType: 'photo' }),
              createMockPost('post3', { contentType: 'video' }),
              createMockPost('post4', { contentType: 'photo' })
            ],
            hasMore: false
          }
        })
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText(/Posts from @testuser \(4 of 4\)/i)).toBeInTheDocument()
      })

      // Filter to videos only
      const filterButton = screen.getByRole('button', { name: /all posts/i })
      await user.click(filterButton)

      const videoOption = screen.getByRole('menuitem', { name: /video only/i })
      await user.click(videoOption)

      await waitFor(() => {
        expect(screen.getByText(/Posts from @testuser \(2 of 4\)/i)).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('should reset posts and pagination when refresh is clicked', async () => {
      const user = userEvent.setup()

      // Mock page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post1', 'post2'], true, 'cursor-page2')
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText('Test Post post1')).toBeInTheDocument()
      })

      // Load page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['post3', 'post4'], false)
      })

      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText('Test Post post3')).toBeInTheDocument()
      })

      // Verify 4 posts are displayed
      expect(screen.getByText(/Posts from @testuser \(4 of 4\)/i)).toBeInTheDocument()

      // Mock refresh (returns to page 1 with new data)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(['newpost1', 'newpost2', 'newpost3'], true, 'cursor-new')
      })

      // Click refresh
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      await waitFor(() => {
        expect(screen.getByText('Test Post newpost1')).toBeInTheDocument()
      })

      // Old posts should be gone
      expect(screen.queryByText('Test Post post1')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Post post3')).not.toBeInTheDocument()

      // Count should be reset
      expect(screen.getByText(/Posts from @testuser \(3 of 3\)/i)).toBeInTheDocument()
    })
  })

  describe('Upsert Stats Display', () => {
    it('should display sync stats when available', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createMockApiResponse(['post1', 'post2'], false).data,
          upsertResult: {
            stats: {
              postsCreated: 5,
              postsUpdated: 3,
              totalPosts: 8
            }
          }
        })
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText(/Synced: 5 new, 3 updated/i)).toBeInTheDocument()
      })
    })

    it('should update sync stats on Load More', async () => {
      const user = userEvent.setup()

      // Page 1 stats
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createMockApiResponse(['post1', 'post2'], true, 'cursor-page2').data,
          upsertResult: {
            stats: {
              postsCreated: 2,
              postsUpdated: 0,
              totalPosts: 2
            }
          }
        })
      })

      render(<ProfileExplorerPage />)

      const input = getInput()
      await user.type(input, '@testuser')
      await user.click(getExploreButton())

      await waitFor(() => {
        expect(screen.getByText(/Synced: 2 new, 0 updated/i)).toBeInTheDocument()
      })

      // Page 2 stats
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createMockApiResponse(['post3', 'post4'], false).data,
          upsertResult: {
            stats: {
              postsCreated: 1,
              postsUpdated: 1,
              totalPosts: 4
            }
          }
        })
      })

      await user.click(screen.getByRole('button', { name: /load more/i }))

      await waitFor(() => {
        expect(screen.getByText(/Synced: 1 new, 1 updated/i)).toBeInTheDocument()
      })
    })
  })
})
