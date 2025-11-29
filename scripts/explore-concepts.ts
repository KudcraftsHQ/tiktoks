/**
 * Script to explore concept bank data for analysis
 * Run with: bun scripts/explore-concepts.ts
 */

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Concept Bank Data Exploration ===\n')

  // Get all concepts grouped by type
  const concepts = await prisma.conceptBank.findMany({
    where: { isActive: true },
    include: {
      examples: {
        select: {
          id: true,
          text: true,
          sourceType: true,
        }
      },
      _count: {
        select: { examples: true }
      }
    },
    orderBy: [
      { type: 'asc' },
      { createdAt: 'asc' }
    ]
  })

  // Group by type
  const hookConcepts = concepts.filter(c => c.type === 'HOOK')
  const contentConcepts = concepts.filter(c => c.type === 'CONTENT')
  const ctaConcepts = concepts.filter(c => c.type === 'CTA')

  console.log(`Total concepts: ${concepts.length}`)
  console.log(`- HOOK: ${hookConcepts.length}`)
  console.log(`- CONTENT: ${contentConcepts.length}`)
  console.log(`- CTA: ${ctaConcepts.length}`)
  console.log('')

  // Show HOOK concepts with examples
  console.log('=== HOOK CONCEPTS ===\n')
  for (const concept of hookConcepts) {
    console.log(`📌 "${concept.title}"`)
    console.log(`   Core: ${concept.coreMessage}`)
    console.log(`   Examples (${concept.examples.length}):`)
    for (const example of concept.examples.slice(0, 3)) {
      const preview = example.text.slice(0, 100).replace(/\n/g, ' ')
      console.log(`     - [${example.sourceType}] "${preview}..."`)
    }
    if (concept.examples.length > 3) {
      console.log(`     ... and ${concept.examples.length - 3} more`)
    }
    console.log('')
  }

  // Show CONTENT concepts with examples
  console.log('=== CONTENT CONCEPTS ===\n')
  for (const concept of contentConcepts.slice(0, 10)) {
    console.log(`📌 "${concept.title}"`)
    console.log(`   Core: ${concept.coreMessage}`)
    console.log(`   Examples (${concept.examples.length}):`)
    for (const example of concept.examples.slice(0, 2)) {
      const preview = example.text.slice(0, 100).replace(/\n/g, ' ')
      console.log(`     - [${example.sourceType}] "${preview}..."`)
    }
    if (concept.examples.length > 2) {
      console.log(`     ... and ${concept.examples.length - 2} more`)
    }
    console.log('')
  }
  if (contentConcepts.length > 10) {
    console.log(`... and ${contentConcepts.length - 10} more CONTENT concepts\n`)
  }

  // Show CTA concepts with examples
  console.log('=== CTA CONCEPTS ===\n')
  for (const concept of ctaConcepts) {
    console.log(`📌 "${concept.title}"`)
    console.log(`   Core: ${concept.coreMessage}`)
    console.log(`   Examples (${concept.examples.length}):`)
    for (const example of concept.examples.slice(0, 2)) {
      const preview = example.text.slice(0, 100).replace(/\n/g, ' ')
      console.log(`     - [${example.sourceType}] "${preview}..."`)
    }
    if (concept.examples.length > 2) {
      console.log(`     ... and ${concept.examples.length - 2} more`)
    }
    console.log('')
  }

  // Analyze example variety
  console.log('=== ANALYSIS ===\n')

  const totalExamples = concepts.reduce((sum, c) => sum + c.examples.length, 0)
  console.log(`Total examples across all concepts: ${totalExamples}`)

  const avgExamplesPerConcept = totalExamples / concepts.length
  console.log(`Average examples per concept: ${avgExamplesPerConcept.toFixed(1)}`)

  const conceptsWithManyExamples = concepts.filter(c => c.examples.length >= 5)
  console.log(`Concepts with 5+ examples: ${conceptsWithManyExamples.length}`)

  const conceptsWithFewExamples = concepts.filter(c => c.examples.length <= 2)
  console.log(`Concepts with 1-2 examples: ${conceptsWithFewExamples.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
