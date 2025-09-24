import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default collection if it doesn't exist
  const defaultCollection = await prisma.collection.findFirst({
    where: { isDefault: true }
  })

  if (!defaultCollection) {
    await prisma.collection.create({
      data: {
        name: 'My Collection',
        description: 'Default collection for saved posts',
        color: '#3b82f6',
        isDefault: true
      }
    })
    console.log('Created default collection')
  }

  console.log('Database seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })