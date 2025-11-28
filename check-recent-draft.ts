import { PrismaClient } from './src/generated/prisma'

const prisma = new PrismaClient()

async function checkRecentDraft() {
  const draft = await prisma.remixPost.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      slideClassifications: true,
      slides: true
    }
  })

  if (draft) {
    console.log('Most recent draft ID:', draft.id)
    console.log('Created at:', draft.createdAt)
    
    const classifications = typeof draft.slideClassifications === 'string' 
      ? JSON.parse(draft.slideClassifications)
      : draft.slideClassifications
    
    console.log('\nSlide Classifications:')
    console.log(JSON.stringify(classifications, null, 2))
    
    const slides = typeof draft.slides === 'string'
      ? JSON.parse(draft.slides)
      : draft.slides
    
    console.log('\nNumber of slides:', Array.isArray(slides) ? slides.length : 0)
  }

  await prisma.$disconnect()
}

checkRecentDraft().catch(console.error)
