#!/usr/bin/env node

/**
 * Debug script to fetch all posts from a TikTok profile and search for a specific post
 *
 * Usage: node debug-profile-posts.js
 */

const API_KEY = 'iGcY5Fu60jeSvGNmQaojBvqB0dE3'
const TARGET_HANDLE = 'emily.growth'
const TARGET_POST_ID = '7502513444751543574'

async function fetchAllPosts(handle) {
  const allPosts = []
  let hasMore = true
  let maxCursor = undefined
  let pageNumber = 1

  console.log(`\n🔍 Fetching posts for @${handle}...\n`)

  while (hasMore) {
    try {
      // Build API URL
      const baseUrl = 'https://api.scrapecreators.com/v3/tiktok/profile/videos'
      const params = new URLSearchParams({
        handle: handle,
        trim: 'true'
      })

      if (maxCursor) {
        params.append('max_cursor', maxCursor)
      }

      const apiUrl = `${baseUrl}?${params.toString()}`

      console.log(`📄 Page ${pageNumber}: ${apiUrl}`)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': API_KEY
        }
      })

      if (!response.ok) {
        console.error(`❌ API request failed with status ${response.status}`)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        break
      }

      const data = await response.json()

      // Check for error status in response
      if (data.status_code !== undefined && data.status_code !== 0) {
        console.error(`❌ API returned error status: ${data.status_code}, message: ${data.status_msg || 'No message'}`)
        break
      }

      const posts = data.aweme_list || []

      console.log(`   ✓ Fetched ${posts.length} posts`)
      console.log(`   has_more: ${data.has_more}`)
      console.log(`   max_cursor: ${data.max_cursor}`)

      // Log post IDs and key metrics for this page
      posts.forEach((post, index) => {
        const viewCount = post.statistics?.play_count || 0
        const isPinned = post.is_top === 1 || post.is_top === true
        console.log(`   ${index + 1}. ID: ${post.aweme_id} | Views: ${viewCount.toLocaleString()} ${isPinned ? '📌 PINNED' : ''}`)
      })

      allPosts.push(...posts)

      // Check if we found the target post on this page
      const targetPost = posts.find(post => post.aweme_id === TARGET_POST_ID)
      if (targetPost) {
        console.log(`\n✨ FOUND TARGET POST on page ${pageNumber}!`)
        console.log(`   ID: ${targetPost.aweme_id}`)
        console.log(`   Description: ${targetPost.desc}`)
        console.log(`   Views: ${targetPost.statistics?.play_count?.toLocaleString() || 0}`)
        console.log(`   Likes: ${targetPost.statistics?.digg_count?.toLocaleString() || 0}`)
        console.log(`   Pinned: ${targetPost.is_top === 1 || targetPost.is_top === true}`)
        console.log(`   Created: ${new Date(targetPost.create_time * 1000).toISOString()}`)
      }

      // Update pagination
      hasMore = !!data.has_more
      maxCursor = data.max_cursor?.toString()
      pageNumber++

      // Small delay to be nice to the API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

    } catch (error) {
      console.error(`❌ Error on page ${pageNumber}:`, error.message)
      break
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total pages fetched: ${pageNumber - 1}`)
  console.log(`   Total posts fetched: ${allPosts.length}`)

  return allPosts
}

async function main() {
  console.log('='.repeat(80))
  console.log('🔎 TikTok Profile Posts Debug Script')
  console.log('='.repeat(80))
  console.log(`Target Profile: @${TARGET_HANDLE}`)
  console.log(`Looking for Post ID: ${TARGET_POST_ID}`)
  console.log('='.repeat(80))

  const allPosts = await fetchAllPosts(TARGET_HANDLE)

  // Final search
  console.log(`\n🔍 Final Search for Target Post ID: ${TARGET_POST_ID}`)
  const targetPost = allPosts.find(post => post.aweme_id === TARGET_POST_ID)

  if (targetPost) {
    console.log(`\n✅ POST FOUND!`)
    console.log(JSON.stringify(targetPost, null, 2))
  } else {
    console.log(`\n❌ POST NOT FOUND in ${allPosts.length} posts`)
    console.log(`\nAll post IDs fetched:`)
    allPosts.forEach((post, index) => {
      const viewCount = post.statistics?.play_count || 0
      console.log(`${index + 1}. ${post.aweme_id} (${viewCount.toLocaleString()} views)`)
    })
  }

  // Additional analysis: Top posts by views
  console.log(`\n📈 Top 10 posts by view count:`)
  const sortedByViews = [...allPosts].sort((a, b) =>
    (b.statistics?.play_count || 0) - (a.statistics?.play_count || 0)
  )
  sortedByViews.slice(0, 10).forEach((post, index) => {
    const viewCount = post.statistics?.play_count || 0
    console.log(`${index + 1}. ID: ${post.aweme_id} | ${viewCount.toLocaleString()} views | ${post.desc?.slice(0, 50)}...`)
  })
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
