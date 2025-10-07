#!/usr/bin/env node

import { PrismaClient } from './src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function testProfileAPI() {
  try {
    console.log('🔍 Testing profile API for @emily.growth\n')

    // Step 1: Get profile by handle
    console.log('Step 1: Fetching profile by handle...')
    const profile = await prisma.tiktokProfile.findUnique({
      where: { handle: 'emily.growth' }
    })

    if (!profile) {
      console.log('❌ Profile not found')
      return
    }

    console.log('✅ Profile found:')
    console.log(`   ID: ${profile.id}`)
    console.log(`   Handle: @${profile.handle}`)
    console.log(`   Total Posts: ${profile.totalPosts}`)
    console.log()

    // Step 2: Fetch posts using the same query as the API
    console.log('Step 2: Fetching posts for profile (simulating API call)...')
    const page = 1
    const limit = 50
    const skip = (page - 1) * limit

    const [posts, total] = await Promise.all([
      prisma.tiktokPost.findMany({
        where: { profileId: profile.id },
        orderBy: {
          publishedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.tiktokPost.count({ where: { profileId: profile.id } })
    ])

    console.log(`✅ Fetched ${posts.length} posts out of ${total} total`)
    console.log()

    // Step 3: Check if target post is in the results
    console.log('Step 3: Looking for target post 7502513444751543574...')
    const targetPost = posts.find(p => p.tiktokId === '7502513444751543574')

    if (targetPost) {
      console.log('✅ TARGET POST FOUND in the results!')
      console.log(`   TikTok ID: ${targetPost.tiktokId}`)
      console.log(`   Title: ${targetPost.title}`)
      console.log(`   View Count: ${targetPost.viewCount?.toString() || '0'}`)
      console.log(`   Published At: ${targetPost.publishedAt}`)
      console.log(`   Content Type: ${targetPost.contentType}`)
    } else {
      console.log('❌ TARGET POST NOT FOUND in the first page')
      console.log()
      console.log('All post IDs on this page:')
      posts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.tiktokId} | ${p.viewCount?.toString() || '0'} views | ${p.publishedAt}`)
      })
    }

    console.log()
    console.log('Step 4: Direct search for the target post...')
    const directPost = await prisma.tiktokPost.findUnique({
      where: { tiktokId: '7502513444751543574' }
    })

    if (directPost) {
      console.log('✅ Post exists in database')
      console.log(`   Profile ID: ${directPost.profileId}`)
      console.log(`   Profile ID matches: ${directPost.profileId === profile.id}`)
      console.log(`   Published At: ${directPost.publishedAt}`)
      console.log()

      // Check ordering
      console.log('Step 5: Checking post ordering...')
      const allPostsOrdered = await prisma.tiktokPost.findMany({
        where: { profileId: profile.id },
        orderBy: { publishedAt: 'desc' },
        select: {
          tiktokId: true,
          publishedAt: true,
          viewCount: true
        }
      })

      const targetIndex = allPostsOrdered.findIndex(p => p.tiktokId === '7502513444751543574')
      console.log(`   Target post is at index ${targetIndex} in ordered list`)
      console.log(`   Should be on page ${Math.floor(targetIndex / limit) + 1}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProfileAPI()
