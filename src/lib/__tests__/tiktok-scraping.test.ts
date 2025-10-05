import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scrapeProfileVideos } from '../tiktok-scraping'
import * as redisCache from '../redis-cache'

// Mock the redis-cache module
vi.mock('../redis-cache', () => ({
  getCachedData: vi.fn(),
  setCachedData: vi.fn(),
  CACHE_KEYS: {
    PROFILE_VIDEOS: 'tiktok:profile:videos'
  },
  CACHE_TTL: {
    ONE_HOUR: 3600
  }
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('scrapeProfileVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no cached data
    vi.mocked(redisCache.getCachedData).mockResolvedValue(null)
    // Set API key
    process.env.SCRAPECREATORS_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('API Key Validation', () => {
    it('should throw error when API key is not configured', async () => {
      delete process.env.SCRAPECREATORS_API_KEY

      await expect(scrapeProfileVideos('testuser')).rejects.toThrow(
        'SCRAPECREATORS_API_KEY is not configured'
      )
    })
  })

  describe('Cache Behavior', () => {
    it('should return cached data when available', async () => {
      const cachedData = {
        posts: [],
        profile: { handle: 'testuser' },
        hasMore: false
      }

      vi.mocked(redisCache.getCachedData).mockResolvedValue(cachedData)

      const result = await scrapeProfileVideos('testuser')

      expect(result).toEqual(cachedData)
      expect(redisCache.getCachedData).toHaveBeenCalledWith(
        'tiktok:profile:videos',
        { handle: 'testuser', max_cursor: '', trim: true }
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should cache API response on successful fetch', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            desc: 'Test video #hashtag',
            create_time: 1700000000,
            author: {
              nickname: 'Test User',
              unique_id: 'testuser',
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {
              play_count: 1000,
              digg_count: 100,
              comment_count: 10,
              share_count: 5,
              collect_count: 2
            },
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] },
              duration: 15
            }
          }
        ],
        has_more: true,
        max_cursor: '1700000000'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(redisCache.setCachedData).toHaveBeenCalledWith(
        'tiktok:profile:videos',
        expect.objectContaining({
          posts: expect.any(Array),
          hasMore: true,
          maxCursor: '1700000000'
        }),
        3600,
        { handle: 'testuser', max_cursor: '', trim: true }
      )
    })
  })

  describe('API Request Construction', () => {
    it('should make correct API request without cursor', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      await scrapeProfileVideos('testuser')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scrapecreators.com/v3/tiktok/profile/videos?handle=testuser&trim=true',
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-api-key': 'test-api-key'
          }
        }
      )
    })

    it('should include max_cursor in API request when provided', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      await scrapeProfileVideos('testuser', '1700000000')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scrapecreators.com/v3/tiktok/profile/videos?handle=testuser&trim=true&max_cursor=1700000000',
        expect.any(Object)
      )
    })

    it('should respect trim parameter', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      await scrapeProfileVideos('testuser', undefined, false)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scrapecreators.com/v3/tiktok/profile/videos?handle=testuser&trim=false',
        expect.any(Object)
      )
    })
  })

  describe('API Response Handling', () => {
    it('should throw error on non-200 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'User not found'
      })

      await expect(scrapeProfileVideos('testuser')).rejects.toThrow(
        'API request failed with status 404: Not Found'
      )
    })

    it('should throw error when API returns error status_code', async () => {
      const mockApiResponse = {
        status_code: 10000,
        status_msg: 'User not found',
        aweme_list: []
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      await expect(scrapeProfileVideos('testuser')).rejects.toThrow(
        'API returned error status: 10000'
      )
    })

    it('should handle response with missing aweme_list gracefully', async () => {
      // Response with missing aweme_list will default to empty array
      const responseWithDefaults = {
        status_code: 0
        // aweme_list will default to [] due to schema
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => responseWithDefaults
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('Video Post Parsing', () => {
    it('should correctly parse video post data', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '7123456789',
            desc: 'Amazing video! #viral #fyp @mentioned.user',
            create_time: 1700000000,
            share_url: 'https://www.tiktok.com/@testuser/video/7123456789',
            author: {
              nickname: 'Test User',
              unique_id: 'testuser',
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] },
              signature: 'Bio here',
              verified: true
            },
            statistics: {
              play_count: 10000,
              digg_count: 500,
              comment_count: 50,
              share_count: 25,
              collect_count: 10
            },
            video: {
              height: 1920,
              width: 1080,
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] },
              duration: 15
            },
            music: {
              id: 'music123',
              title: 'Test Song',
              author: 'Artist',
              play_url: { url_list: ['https://example.com/music.mp3'] }
            }
          }
        ],
        has_more: true,
        max_cursor: '1700000000',
        min_cursor: '1699999999'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]).toMatchObject({
        tiktokId: '7123456789',
        tiktokUrl: 'https://www.tiktok.com/@testuser/video/7123456789',
        contentType: 'video',
        title: 'Amazing video!',
        description: 'Amazing video! #viral #fyp @mentioned.user',
        authorNickname: 'Test User',
        authorHandle: 'testuser',
        authorAvatar: 'https://example.com/avatar.jpg',
        hashtags: [
          { text: '#viral', url: 'https://www.tiktok.com/tag/viral' },
          { text: '#fyp', url: 'https://www.tiktok.com/tag/fyp' }
        ],
        mentions: ['mentioned.user'],
        viewCount: 10000,
        likeCount: 500,
        commentCount: 50,
        shareCount: 25,
        saveCount: 10,
        videoUrl: 'https://example.com/video.mp4',
        coverUrl: 'https://example.com/cover.jpg',
        musicUrl: 'https://example.com/music.mp3',
        duration: 15,
        images: []
      })

      expect(result.posts[0].publishedAt).toEqual(new Date(1700000000 * 1000))
    })

    it('should correctly parse photo post data', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '7987654321',
            desc: 'Photo carousel #photo',
            create_time: 1700000000,
            author: {
              nickname: 'Test User',
              unique_id: 'testuser',
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {
              play_count: 5000,
              digg_count: 250,
              comment_count: 25,
              share_count: 10
            },
            image_post_info: {
              images: [
                {
                  display_image: {
                    url_list: ['https://example.com/image1.jpg'],
                    width: 1080,
                    height: 1920
                  }
                },
                {
                  display_image: {
                    url_list: ['https://example.com/image2.jpg'],
                    width: 1080,
                    height: 1920
                  }
                }
              ]
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]).toMatchObject({
        contentType: 'photo',
        images: [
          { url: 'https://example.com/image1.jpg', width: 1080, height: 1920 },
          { url: 'https://example.com/image2.jpg', width: 1080, height: 1920 }
        ],
        coverUrl: 'https://example.com/image1.jpg',
        videoUrl: undefined,
        duration: undefined
      })
    })

    it('should handle posts with minimal data', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '111',
            create_time: 1700000000,
            author: {
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]).toMatchObject({
        tiktokId: '111',
        description: '',
        title: 'TikTok Post',
        authorNickname: '',
        authorHandle: '',
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        saveCount: 0
      })
    })
  })

  describe('Profile Data Extraction', () => {
    it('should extract profile data from first post', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            create_time: 1700000000,
            author: {
              nickname: 'Test User',
              unique_id: 'testuser',
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] },
              signature: 'My bio here',
              verified: true
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.profile).toEqual({
        handle: 'testuser',
        nickname: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'My bio here',
        verified: true
      })
    })

    it('should not include profile data when no posts', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.profile).toBeUndefined()
      expect(result.posts).toHaveLength(0)
    })
  })

  describe('Pagination Metadata', () => {
    it('should return correct pagination metadata', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: 1,
        max_cursor: 1700000000,
        min_cursor: 1699999999
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.hasMore).toBe(true)
      expect(result.maxCursor).toBe('1700000000')
      expect(result.minCursor).toBe('1699999999')
    })

    it('should handle boolean has_more value', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.hasMore).toBe(false)
    })

    it('should handle string cursor values', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [],
        has_more: true,
        max_cursor: '1700000000',
        min_cursor: '1699999999'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.maxCursor).toBe('1700000000')
      expect(result.minCursor).toBe('1699999999')
    })
  })

  describe('Text Extraction Helpers', () => {
    it('should extract hashtags correctly', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            desc: 'Test #viral #FYP #TikTok #ñoño',
            create_time: 1700000000,
            author: {
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].hashtags).toEqual([
        { text: '#viral', url: 'https://www.tiktok.com/tag/viral' },
        { text: '#FYP', url: 'https://www.tiktok.com/tag/FYP' },
        { text: '#TikTok', url: 'https://www.tiktok.com/tag/TikTok' },
        { text: '#ñoño', url: 'https://www.tiktok.com/tag/ñoño' }
      ])
    })

    it('should extract mentions correctly', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            desc: 'Check out @user1 and @user.name @another_user',
            create_time: 1700000000,
            author: {
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].mentions).toEqual(['user1', 'user.name', 'another_user'])
    })

    it('should generate title from description', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            desc: 'This is my video description without hashtags #viral @user',
            create_time: 1700000000,
            author: {
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].title).toBe('This is my video description without hashtags')
    })

    it('should truncate long titles', async () => {
      const longDesc = 'A'.repeat(100) + ' #hashtag'
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            desc: longDesc,
            create_time: 1700000000,
            author: {
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].title).toHaveLength(63) // 60 chars + '...'
      expect(result.posts[0].title).toMatch(/\.\.\.$/)
    })

    it('should fallback to "TikTok Post" when description is only hashtags', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            desc: '#viral #fyp #trending',
            create_time: 1700000000,
            author: {
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].title).toBe('TikTok Post')
    })
  })

  describe('TikTok URL Generation', () => {
    it('should use share_url when available', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '123',
            create_time: 1700000000,
            share_url: 'https://vm.tiktok.com/shortlink',
            author: {
              unique_id: 'testuser',
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].tiktokUrl).toBe('https://vm.tiktok.com/shortlink')
    })

    it('should generate URL when share_url is missing', async () => {
      const mockApiResponse = {
        status_code: 0,
        aweme_list: [
          {
            aweme_id: '7123456789',
            create_time: 1700000000,
            author: {
              unique_id: 'testuser',
              avatar_medium: { url_list: ['https://example.com/avatar.jpg'] }
            },
            statistics: {},
            video: {
              play_addr: { url_list: ['https://example.com/video.mp4'] },
              cover: { url_list: ['https://example.com/cover.jpg'] }
            }
          }
        ],
        has_more: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await scrapeProfileVideos('testuser')

      expect(result.posts[0].tiktokUrl).toBe('https://www.tiktok.com/@testuser/video/7123456789')
    })
  })
})
