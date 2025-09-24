import { NextRequest, NextResponse } from 'next/server'
import { scrapeProfileVideos } from '@/lib/tiktok-scraping'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const handle = searchParams.get('handle')
    const maxCursor = searchParams.get('max_cursor')
    const trim = searchParams.get('trim') === 'true'
    const autoSave = searchParams.get('autoSave') !== 'false' // Default to true

    if (!handle) {
      return NextResponse.json(
        { error: 'handle parameter is required' },
        { status: 400 }
      )
    }

    // Validate handle format (remove @ if present)
    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

    if (!/^[a-zA-Z0-9._-]+$/.test(cleanHandle)) {
      return NextResponse.json(
        { error: 'Invalid handle format' },
        { status: 400 }
      )
    }

    console.log(`Fetching videos for profile: @${cleanHandle}`)

    const result = await scrapeProfileVideos(cleanHandle, maxCursor || undefined, trim)

    // Auto-upsert to database if autoSave is enabled and we have posts
    let upsertResult = null
    if (autoSave && result.posts.length > 0) {
      try {
        // Use enhanced profile data from scraping result
        const profileData = {
          handle: cleanHandle,
          nickname: result.profile?.nickname || result.posts[0]?.authorNickname,
          avatar: result.profile?.avatar || result.posts[0]?.authorAvatar,
          bio: result.profile?.bio, // Now available from author.signature
          verified: result.profile?.verified, // Now available from author.verified
          followerCount: undefined, // Not available in videos API response
          followingCount: undefined, // Not available in videos API response
          videoCount: result.posts.length, // Use number of fetched posts as estimate
          likeCount: undefined // Not available in videos API response
        }

        // Convert posts to the format expected by bulk upsert API
        const postsForUpsert = result.posts.map(post => ({
          tiktokId: post.tiktokId,
          tiktokUrl: post.tiktokUrl,
          contentType: post.contentType,
          title: post.title,
          description: post.description,
          authorNickname: post.authorNickname,
          authorHandle: post.authorHandle,
          authorAvatar: post.authorAvatar,
          hashtags: post.hashtags,
          mentions: post.mentions,
          viewCount: post.viewCount,
          likeCount: post.likeCount,
          shareCount: post.shareCount,
          commentCount: post.commentCount,
          saveCount: post.saveCount,
          duration: post.duration,
          videoUrl: post.videoUrl,
          coverUrl: post.coverUrl,
          musicUrl: post.musicUrl,
          images: post.images,
          publishedAt: post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt
        }))

        // Call bulk upsert API
        const baseUrl = process.env.NODE_ENV === 'production'
          ? request.nextUrl.origin
          : 'http://localhost:3000'

        const upsertResponse = await fetch(`${baseUrl}/api/tiktok/posts/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profile: profileData,
            posts: postsForUpsert
          })
        })

        if (upsertResponse.ok) {
          upsertResult = await upsertResponse.json()
          console.log(`Successfully upserted ${upsertResult.stats.totalPosts} posts for @${cleanHandle}`)
        } else {
          console.error('Failed to auto-upsert posts:', await upsertResponse.text())
        }
      } catch (upsertError) {
        console.error('Error during auto-upsert:', upsertError)
        // Don't fail the main request if upsert fails
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      upsertResult: upsertResult
    })
  } catch (error) {
    console.error('Failed to fetch profile videos:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile videos'

    // Handle specific API errors
    if (errorMessage.includes('status 404')) {
      return NextResponse.json(
        { error: 'Profile not found or is private' },
        { status: 404 }
      )
    }

    if (errorMessage.includes('status 403')) {
      return NextResponse.json(
        { error: 'Access forbidden - profile may be private' },
        { status: 403 }
      )
    }

    if (errorMessage.includes('status 429')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    if (errorMessage.includes('SCRAPECREATORS_API_KEY')) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}