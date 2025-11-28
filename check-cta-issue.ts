import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function checkCTAIssue() {
  // Get a recent draft with classifications
  const draft = await prisma.remixPost.findFirst({
    where: {
      slideClassifications: {
        not: '[]'
      }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slideClassifications: true,
      slides: true
    }
  })

  if (draft) {
    const classifications = typeof draft.slideClassifications === 'string'
      ? JSON.parse(draft.slideClassifications)
      : draft.slideClassifications

    const slides = typeof draft.slides === 'string'
      ? JSON.parse(draft.slides)
      : draft.slides

    console.log('Draft:', draft.name)
    console.log('Total slides:', slides.length)
    console.log('\nClassifications:')

    classifications.forEach((c: any) => {
      console.log(`  Slide ${c.slideIndex}: ${c.type} (${c.categoryName})`)
    })

    console.log('\nLast slide classification:')
    const lastSlideIndex = slides.length - 1
    const lastClassification = classifications.find((c: any) => c.slideIndex === lastSlideIndex)
    const lastType = lastClassification ? lastClassification.type : 'NO CLASSIFICATION'
    console.log(`  Index ${lastSlideIndex}: ${lastType}`)

    const normalizedType = lastClassification ? lastClassification.type.toUpperCase() : ''
    if (normalizedType !== 'CTA') {
      console.log('\n❌ PROBLEM: Last slide is NOT marked as CTA!')
      console.log('   It is marked as:', lastType)
    } else {
      console.log('\n✅ Last slide is correctly marked as CTA')
    }
  }

  await prisma.$disconnect()
}

checkCTAIssue().catch(console.error)
