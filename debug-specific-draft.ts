import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function debugDraft() {
  // Get the most recent draft (the one in the screenshot)
  const draft = await prisma.remixPost.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slideClassifications: true,
      slides: true
    }
  })

  if (!draft) {
    console.log('No draft found')
    await prisma.$disconnect()
    return
  }

  console.log('Draft ID:', draft.id)
  console.log('Draft Name:', draft.name)
  console.log('\n=== Slide Classifications (from DB) ===')

  const classifications = draft.slideClassifications as any
  console.log('Raw value:', JSON.stringify(classifications, null, 2))
  console.log('Is array:', Array.isArray(classifications))

  if (Array.isArray(classifications)) {
    console.log('Count:', classifications.length)
    classifications.forEach((c: any) => {
      const typeStr = typeof c.type
      console.log(`  Slide ${c.slideIndex}: type="${c.type}" (${typeStr})`)
    })
  }

  const slides = typeof draft.slides === 'string'
    ? JSON.parse(draft.slides)
    : draft.slides

  console.log('\n=== Slides ===')
  console.log('Total slides:', slides.length)

  await prisma.$disconnect()
}

debugDraft().catch(console.error)
