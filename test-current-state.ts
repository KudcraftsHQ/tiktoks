import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function testCurrentState() {
  console.log('=== Checking Current State ===\n')

  const draftsWithPosts = await prisma.remixPost.findMany({
    where: {
      originalPostId: { not: null }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      createdAt: true,
      slideClassifications: true
    }
  })

  console.log(`Found ${draftsWithPosts.length} drafts with original posts\n`)

  for (const draft of draftsWithPosts) {
    const classifications = draft.slideClassifications as any
    const classCount = Array.isArray(classifications) ? classifications.length : 0
    
    console.log(`Draft: ${draft.name}`)
    console.log(`  Created: ${draft.createdAt}`)
    console.log(`  Classifications: ${classCount}`)
    
    if (classCount > 0) {
      const types = classifications.map((c: any) => c.type).join(', ')
      console.log(`  Types: ${types}`)
    }
    console.log()
  }

  await prisma.$disconnect()
}

testCurrentState().catch(console.error)
