import { describe, it, expect, beforeAll } from 'vitest'
import { scrapeProfileVideos } from '../tiktok-scraping'

/**
 * Integration tests for scrapeProfileVideos with real TikTok API
 *
 * These tests validate:
 * 1. Pagination works correctly (cursor-based)
 * 2. Subsequent pages return different posts (no duplicates)
 * 3. API integration with @ava.goviral profile
 *
 * NOTE: These tests require SCRAPECREATORS_API_KEY to be set
 * and will make real API calls. They may be slow and count against API quota.
 */
describe('scrapeProfileVideos - Integration Tests', () => {
  const TEST_HANDLE = 'ava.goviral'

  beforeAll(() => {
    if (!process.env.SCRAPECREATORS_API_KEY) {
      throw new Error('SCRAPECREATORS_API_KEY must be set for integration tests')
    }
  })

  describe('Pagination with @ava.goviral', () => {
    it('should fetch 3 pages and validate pagination works correctly', async () => {
      // Fetch first page
      const page1 = await scrapeProfileVideos(TEST_HANDLE, undefined, true)

      console.log(`\n📄 Page 1: Fetched ${page1.posts.length} posts`)
      console.log(`   Has more: ${page1.hasMore}`)
      console.log(`   Max cursor: ${page1.maxCursor}`)
      console.log(`   First post ID: ${page1.posts[0]?.tiktokId}`)
      console.log(`   Last post ID: ${page1.posts[page1.posts.length - 1]?.tiktokId}`)

      // Validate first page
      expect(page1.posts.length).toBeGreaterThan(0)
      expect(page1.profile).toBeDefined()
      expect(page1.profile?.handle).toBe(TEST_HANDLE)

      // If no more pages, test is done
      if (!page1.hasMore || !page1.maxCursor) {
        console.log('⚠️  Only one page of results available for this profile')
        return
      }

      // Fetch second page
      const page2 = await scrapeProfileVideos(TEST_HANDLE, page1.maxCursor, true)

      console.log(`\n📄 Page 2: Fetched ${page2.posts.length} posts`)
      console.log(`   Has more: ${page2.hasMore}`)
      console.log(`   Max cursor: ${page2.maxCursor}`)
      console.log(`   First post ID: ${page2.posts[0]?.tiktokId}`)
      console.log(`   Last post ID: ${page2.posts[page2.posts.length - 1]?.tiktokId}`)

      // Validate second page
      expect(page2.posts.length).toBeGreaterThan(0)

      // Check for no duplicates between page 1 and page 2
      const page1Ids = new Set(page1.posts.map(p => p.tiktokId))
      const page2Ids = new Set(page2.posts.map(p => p.tiktokId))
      const duplicates = [...page2Ids].filter(id => page1Ids.has(id))

      console.log(`\n🔍 Duplicate Check (Page 1 vs Page 2):`)
      console.log(`   Page 1 unique IDs: ${page1Ids.size}`)
      console.log(`   Page 2 unique IDs: ${page2Ids.size}`)
      console.log(`   Duplicates found: ${duplicates.length}`)

      if (duplicates.length > 0) {
        console.log(`   ⚠️  Duplicate IDs: ${duplicates.join(', ')}`)
      }

      expect(duplicates).toHaveLength(0)
      expect(page2.maxCursor).not.toBe(page1.maxCursor)

      // If no third page, test is done
      if (!page2.hasMore || !page2.maxCursor) {
        console.log('⚠️  Only two pages of results available for this profile')
        return
      }

      // Fetch third page
      const page3 = await scrapeProfileVideos(TEST_HANDLE, page2.maxCursor, true)

      console.log(`\n📄 Page 3: Fetched ${page3.posts.length} posts`)
      console.log(`   Has more: ${page3.hasMore}`)
      console.log(`   Max cursor: ${page3.maxCursor}`)
      console.log(`   First post ID: ${page3.posts[0]?.tiktokId}`)
      console.log(`   Last post ID: ${page3.posts[page3.posts.length - 1]?.tiktokId}`)

      // Validate third page
      expect(page3.posts.length).toBeGreaterThan(0)

      // Check for no duplicates between all pages
      const page3Ids = new Set(page3.posts.map(p => p.tiktokId))
      const duplicatesPage1And3 = [...page3Ids].filter(id => page1Ids.has(id))
      const duplicatesPage2And3 = [...page3Ids].filter(id => page2Ids.has(id))

      console.log(`\n🔍 Duplicate Check (All Pages):`)
      console.log(`   Page 3 unique IDs: ${page3Ids.size}`)
      console.log(`   Duplicates (Page 1 & 3): ${duplicatesPage1And3.length}`)
      console.log(`   Duplicates (Page 2 & 3): ${duplicatesPage2And3.length}`)

      if (duplicatesPage1And3.length > 0) {
        console.log(`   ⚠️  Duplicate IDs (1&3): ${duplicatesPage1And3.join(', ')}`)
      }
      if (duplicatesPage2And3.length > 0) {
        console.log(`   ⚠️  Duplicate IDs (2&3): ${duplicatesPage2And3.join(', ')}`)
      }

      expect(duplicatesPage1And3).toHaveLength(0)
      expect(duplicatesPage2And3).toHaveLength(0)

      // Validate cursor progression
      expect(page3.maxCursor).not.toBe(page2.maxCursor)
      expect(page3.maxCursor).not.toBe(page1.maxCursor)

      // Summary
      const totalPosts = page1.posts.length + page2.posts.length + page3.posts.length
      const totalUniqueIds = new Set([...page1Ids, ...page2Ids, ...page3Ids]).size

      console.log(`\n✅ Pagination Test Summary:`)
      console.log(`   Total posts fetched: ${totalPosts}`)
      console.log(`   Total unique posts: ${totalUniqueIds}`)
      console.log(`   Pagination working: ${totalPosts === totalUniqueIds ? 'YES ✓' : 'NO ✗'}`)

      expect(totalPosts).toBe(totalUniqueIds)
    }, 60000) // 60 second timeout for API calls

    it('should return profile data on first page', async () => {
      const result = await scrapeProfileVideos(TEST_HANDLE)

      expect(result.profile).toBeDefined()
      expect(result.profile?.handle).toBe(TEST_HANDLE)
      expect(result.profile?.nickname).toBeDefined()
      expect(result.profile?.avatar).toBeDefined()

      console.log(`\n👤 Profile Data:`)
      console.log(`   Handle: ${result.profile?.handle}`)
      console.log(`   Nickname: ${result.profile?.nickname}`)
      console.log(`   Verified: ${result.profile?.verified}`)
      console.log(`   Bio: ${result.profile?.bio?.substring(0, 50)}...`)
    }, 30000)

    it('should fetch video posts with correct structure', async () => {
      const result = await scrapeProfileVideos(TEST_HANDLE)

      expect(result.posts.length).toBeGreaterThan(0)

      const firstPost = result.posts[0]

      // Validate required fields
      expect(firstPost.tiktokId).toBeDefined()
      expect(firstPost.tiktokUrl).toBeDefined()
      expect(firstPost.contentType).toMatch(/^(video|photo)$/)
      expect(firstPost.authorNickname).toBeDefined()
      expect(firstPost.authorHandle).toBeDefined()
      expect(firstPost.authorAvatar).toBeDefined()
      // publishedAt can be Date or string (if cached)
      expect(firstPost.publishedAt).toBeTruthy()
      const publishedDate = firstPost.publishedAt instanceof Date
        ? firstPost.publishedAt
        : new Date(firstPost.publishedAt)
      expect(publishedDate).toBeInstanceOf(Date)

      // Validate engagement metrics
      expect(typeof firstPost.viewCount).toBe('number')
      expect(typeof firstPost.likeCount).toBe('number')
      expect(typeof firstPost.commentCount).toBe('number')
      expect(typeof firstPost.shareCount).toBe('number')

      console.log(`\n📱 First Post Data:`)
      console.log(`   ID: ${firstPost.tiktokId}`)
      console.log(`   Type: ${firstPost.contentType}`)
      console.log(`   Title: ${firstPost.title}`)
      console.log(`   URL: ${firstPost.tiktokUrl}`)
      console.log(`   Views: ${firstPost.viewCount.toLocaleString()}`)
      console.log(`   Likes: ${firstPost.likeCount.toLocaleString()}`)
      console.log(`   Comments: ${firstPost.commentCount.toLocaleString()}`)
      console.log(`   Published: ${publishedDate.toISOString()}`)
      console.log(`   Hashtags: ${firstPost.hashtags.map(h => h.text).join(', ')}`)

      if (firstPost.contentType === 'video') {
        expect(firstPost.videoUrl).toBeDefined()
        expect(firstPost.coverUrl).toBeDefined()
        console.log(`   Video URL: ${firstPost.videoUrl}`)
        console.log(`   Duration: ${firstPost.duration}s`)
      } else {
        expect(firstPost.images.length).toBeGreaterThan(0)
        console.log(`   Image count: ${firstPost.images.length}`)
      }
    }, 30000)

    it('should handle empty results gracefully', async () => {
      // Use a likely non-existent user
      const result = await scrapeProfileVideos('nonexistent_user_12345_unlikely_to_exist_98765')
        .catch(() => null)

      // Either returns empty results or throws error
      if (result) {
        expect(result.posts).toHaveLength(0)
        expect(result.hasMore).toBe(false)
      }
      // If it throws, that's also acceptable behavior
    }, 30000)
  })

  describe('Content Type Detection', () => {
    it('should correctly identify video vs photo posts', async () => {
      const result = await scrapeProfileVideos(TEST_HANDLE)

      const videoPosts = result.posts.filter(p => p.contentType === 'video')
      const photoPosts = result.posts.filter(p => p.contentType === 'photo')

      console.log(`\n📊 Content Type Distribution:`)
      console.log(`   Total posts: ${result.posts.length}`)
      console.log(`   Video posts: ${videoPosts.length}`)
      console.log(`   Photo posts: ${photoPosts.length}`)

      // Validate video posts have video fields
      videoPosts.forEach(post => {
        expect(post.videoUrl).toBeDefined()
        expect(post.coverUrl).toBeDefined()
        expect(post.images).toHaveLength(0)
      })

      // Validate photo posts have image arrays
      photoPosts.forEach(post => {
        expect(post.images.length).toBeGreaterThan(0)
        expect(post.videoUrl).toBeUndefined()
        expect(post.coverUrl).toBe(post.images[0]?.url)
      })

      // At least verify all posts have a valid content type
      result.posts.forEach(post => {
        expect(['video', 'photo']).toContain(post.contentType)
      })
    }, 30000)
  })

  describe('Data Quality', () => {
    it('should extract hashtags and mentions correctly', async () => {
      const result = await scrapeProfileVideos(TEST_HANDLE)

      const postsWithHashtags = result.posts.filter(p => p.hashtags.length > 0)
      const postsWithMentions = result.posts.filter(p => p.mentions.length > 0)

      console.log(`\n🏷️  Hashtags & Mentions:`)
      console.log(`   Posts with hashtags: ${postsWithHashtags.length}/${result.posts.length}`)
      console.log(`   Posts with mentions: ${postsWithMentions.length}/${result.posts.length}`)

      if (postsWithHashtags.length > 0) {
        const firstWithHashtags = postsWithHashtags[0]
        console.log(`   Example hashtags: ${firstWithHashtags.hashtags.map(h => h.text).join(', ')}`)

        // Validate hashtag structure
        firstWithHashtags.hashtags.forEach(tag => {
          expect(tag.text).toMatch(/^#/)
          expect(tag.url).toContain('tiktok.com/tag/')
        })
      }

      if (postsWithMentions.length > 0) {
        const firstWithMentions = postsWithMentions[0]
        console.log(`   Example mentions: @${firstWithMentions.mentions.join(', @')}`)

        // Validate mentions don't include @ symbol
        firstWithMentions.mentions.forEach(mention => {
          expect(mention).not.toMatch(/^@/)
        })
      }
    }, 30000)

    it('should have valid timestamps', async () => {
      const result = await scrapeProfileVideos(TEST_HANDLE)

      const now = new Date()
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

      result.posts.forEach(post => {
        // publishedAt can be Date or string (if cached)
        const publishedDate = post.publishedAt instanceof Date
          ? post.publishedAt
          : new Date(post.publishedAt)

        expect(publishedDate).toBeInstanceOf(Date)
        expect(publishedDate.getTime()).toBeLessThanOrEqual(now.getTime())
        // Most posts should be relatively recent (within reasonable time)
        expect(publishedDate.getTime()).toBeGreaterThan(oneYearAgo.getTime())
      })

      const firstDate = result.posts[0]?.publishedAt instanceof Date
        ? result.posts[0].publishedAt
        : new Date(result.posts[0]?.publishedAt)
      const lastDate = result.posts[result.posts.length - 1]?.publishedAt instanceof Date
        ? result.posts[result.posts.length - 1].publishedAt
        : new Date(result.posts[result.posts.length - 1]?.publishedAt)

      console.log(`\n📅 Timestamp Range:`)
      console.log(`   Newest: ${firstDate.toISOString()}`)
      console.log(`   Oldest: ${lastDate.toISOString()}`)
    }, 30000)
  })
})
