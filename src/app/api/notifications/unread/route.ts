import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/notification-service'

/**
 * GET /api/notifications/unread
 * Get unread notifications count and recent unread notifications
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    const [count, notifications] = await Promise.all([
      notificationService.getUnreadCount(),
      notificationService.getUnreadNotifications(limit)
    ])

    return NextResponse.json({
      count,
      notifications
    })
  } catch (error) {
    console.error('Failed to fetch unread notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unread notifications' },
      { status: 500 }
    )
  }
}
