import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:55000'

async function testNewDraftCreation() {
  console.log('=== Testing New Draft Creation ===\n')

  // Create a draft via API (simulating "New Draft" button)
  console.log('Creating draft via API...')
  const response = await fetch(`${BASE_URL}/api/remixes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test New Draft',
      description: 'Testing classification saving',
      bookmarked: false,
      slideCount: 6,
      referenceStructure: {
        slideClassifications: [
          { slideIndex: 0, slideType: 'hook', confidence: 0.98 },
          { slideIndex: 1, slideType: 'content', confidence: 0.97 },
          { slideIndex: 2, slideType: 'content', confidence: 0.96 },
          { slideIndex: 3, slideType: 'content', confidence: 0.95 },
          { slideIndex: 4, slideType: 'cta', confidence: 1 },
          { slideIndex: 5, slideType: 'content', confidence: 1 }
        ]
      }
    })
  })

  if (!response.ok) {
    console.error('❌ API call failed:', await response.text())
    await prisma.$disconnect()
    return
  }

  const result = await response.json()
  const draftId = result.remix.id
  console.log('✅ API returned draft ID:', draftId)

  // Now check what's actually in the database
  console.log('\nChecking database...')
  const draftFromDB = await prisma.remixPost.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      name: true,
      slideClassifications: true
    }
  })

  if (!draftFromDB) {
    console.log('❌ Draft NOT found in database!')
    await prisma.$disconnect()
    return
  }

  console.log('✅ Draft found in database')
  console.log('   Name:', draftFromDB.name)
  
  const classifications = draftFromDB.slideClassifications as any
  console.log('\nClassifications in DB:')
  console.log('   Type:', typeof classifications)
  console.log('   Is array:', Array.isArray(classifications))
  
  if (Array.isArray(classifications)) {
    console.log('   Count:', classifications.length)
    classifications.forEach((c: any) => {
      console.log(`   Slide ${c.slideIndex}: ${c.type}`)
    })
    
    const ctaSlide = classifications.find((c: any) => c.slideIndex === 4)
    if (ctaSlide?.type?.toUpperCase() === 'CTA') {
      console.log('\n✅ SUCCESS: Slide 4 is correctly classified as CTA')
    } else {
      console.log('\n❌ FAIL: Slide 4 is NOT classified as CTA')
      console.log('   Actual:', ctaSlide)
    }
  } else {
    console.log('   ❌ Classifications is not an array!')
    console.log('   Raw value:', JSON.stringify(classifications))
  }

  await prisma.$disconnect()
}

testNewDraftCreation().catch(console.error)
