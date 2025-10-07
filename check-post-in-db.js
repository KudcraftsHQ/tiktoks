#!/usr/bin/env node

import { PrismaClient } from './src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function checkPost() {
  try {
    console.log('🔍 Checking for post 7502513444751543574 in database...\n')

    // Find the post
    const post = await prisma.tiktokPost.findUnique({
      where: { tiktokId: '7502513444751543574' },
      include: {
        profile: {
          select: {
            handle: true,
            nickname: true
          }
        }
      }
    })

    if (post) {
      console.log('✅ POST FOUND IN DATABASE!')
      console.log('Post details:')
      console.log(`  - TikTok ID: ${post.tiktokId}`)
      console.log(`  - Title: ${post.title}`)
      console.log(`  - Description: ${post.description}`)
      console.log(`  - View Count: ${post.viewCount?.toString() || '0'}`)
      console.log(`  - Published At: ${post.publishedAt}`)
      console.log(`  - Profile: @${post.profile?.handle} (${post.profile?.nickname})`)
      console.log(`  - Content Type: ${post.contentType}`)
      console.log()
    } else {
      console.log('❌ POST NOT FOUND IN DATABASE')
      console.log()

      // Let's check if the profile exists
      const profile = await prisma.tiktokProfile.findUnique({
        where: { handle: 'emily.growth' }
      })

      if (profile) {
        console.log('✅ Profile exists in database')
        console.log(`  - Handle: @${profile.handle}`)
        console.log(`  - Nickname: ${profile.nickname}`)
        console.log(`  - Total Posts: ${profile.totalPosts}`)
        console.log()

        // Get all posts for this profile
        const allPosts = await prisma.tiktokPost.findMany({
          where: { profileId: profile.id },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          select: {
            tiktokId: true,
            title: true,
            viewCount: true,
            publishedAt: true
          }
        })

        console.log(`📋 First 10 posts for @${profile.handle}:`)
        allPosts.forEach((p, i) => {
          console.log(`  ${i + 1}. ID: ${p.tiktokId} | Views: ${p.viewCount?.toString() || '0'} | ${p.title}`)
        })
        console.log()

        // Check if 7502513444751543574 is in the list
        const targetInList = allPosts.some(p => p.tiktokId === '7502513444751543574')
        if (targetInList) {
          console.log('✅ Target post IS in the database!')
        } else {
          console.log('❌ Target post is NOT in the first 10 posts')

          // Search all posts
          const totalPostCount = await prisma.tiktokPost.count({
            where: { profileId: profile.id }
          })
          console.log(`   Total posts in DB for profile: ${totalPostCount}`)
        }
      } else {
        console.log('❌ Profile @emily.growth does not exist in database')
      }
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPost()
