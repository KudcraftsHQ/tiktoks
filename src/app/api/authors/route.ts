import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const authors = await prisma.carousel.findMany({
      select: {
        author: true,
        _count: {
          select: {
            images: true
          }
        }
      },
      where: {
        author: {
          not: null
        }
      },
      orderBy: {
        author: 'asc'
      }
    })

    // Group by author and count carousels
    const authorCounts = authors.reduce((acc: Record<string, number>, carousel) => {
      if (carousel.author) {
        acc[carousel.author] = (acc[carousel.author] || 0) + 1
      }
      return acc
    }, {})

    const authorList = Object.keys(authorCounts).map(author => ({
      name: author,
      count: authorCounts[author]
    }))

    return NextResponse.json(authorList)
  } catch (error) {
    console.error('Failed to fetch authors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch authors' },
      { status: 500 }
    )
  }
}