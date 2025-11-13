import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/notification-service'

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const notification = await notificationService.markAsRead(id)

    return NextResponse.json(notification)
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}
