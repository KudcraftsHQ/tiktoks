import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default project if it doesn't exist
  const defaultProject = await prisma.project.findFirst({
    where: { isDefault: true }
  })

  if (!defaultProject) {
    await prisma.project.create({
      data: {
        name: 'My Project',
        description: 'Default project for organizing posts',
        color: '#3b82f6',
        isDefault: true
      }
    })
    console.log('Created default project')
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