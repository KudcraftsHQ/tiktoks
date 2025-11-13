import { PrismaClient, NotificationType } from '@/generated/prisma';

const prisma = new PrismaClient();

interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message: string;
  postId?: string;
  metadata?: Record<string, any>;
}

interface DiscordWebhookEmbed {
  title: string;
  description: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: {
    url: string;
  };
  url?: string;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

class NotificationService {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  /**
   * Check if a notification has already been sent for a specific post and type
   */
  async hasNotificationBeenSent(postId: string, type: NotificationType): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: {
        postId,
        type,
      },
    });

    return !!existing;
  }

  /**
   * Create a notification in the database
   */
  async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          type: data.type,
          title: data.title,
          message: data.message,
          postId: data.postId,
          metadata: data.metadata || {},
        },
      });

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Send a notification to Discord webhook
   */
  async sendToDiscord(embed: DiscordWebhookEmbed): Promise<boolean> {
    if (!this.webhookUrl) {
      console.warn('Discord webhook URL not configured, skipping Discord notification');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        console.error('Discord webhook failed:', response.status, await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
      return false;
    }
  }

  /**
   * Check if a post has reached high views threshold and send notification if needed
   */
  async checkAndNotifyHighViews(post: {
    id: string;
    tiktokUrl: string;
    viewCount: bigint | null;
    likeCount: number | null;
    shareCount: number | null;
    commentCount: number | null;
    title?: string | null;
    description?: string | null;
    coverId?: string | null;
  }): Promise<void> {
    const HIGH_VIEWS_THRESHOLD = 1000;

    // Check if views meet threshold
    if (!post.viewCount || post.viewCount < HIGH_VIEWS_THRESHOLD) {
      return;
    }

    // Check if notification already sent
    const alreadySent = await this.hasNotificationBeenSent(post.id, NotificationType.HIGH_VIEWS);
    if (alreadySent) {
      return;
    }

    try {
      // Create notification in database
      const notification = await this.createNotification({
        type: NotificationType.HIGH_VIEWS,
        title: '🔥 Content Performing Well!',
        message: `Your post has reached ${post.viewCount.toLocaleString()} views`,
        postId: post.id,
        metadata: {
          viewCount: post.viewCount.toString(),
          likeCount: post.likeCount,
          shareCount: post.shareCount,
          commentCount: post.commentCount,
          tiktokUrl: post.tiktokUrl,
        },
      });

      // Build Discord embed
      const embed: DiscordWebhookEmbed = {
        title: '🔥 Content Performing Well!',
        description: post.title || post.description || 'A post is gaining traction!',
        color: 0x00ff00, // Green color
        fields: [
          {
            name: '👁️ Views',
            value: post.viewCount.toLocaleString(),
            inline: true,
          },
          {
            name: '❤️ Likes',
            value: post.likeCount?.toLocaleString() || '0',
            inline: true,
          },
          {
            name: '🔄 Shares',
            value: post.shareCount?.toLocaleString() || '0',
            inline: true,
          },
          {
            name: '💬 Comments',
            value: post.commentCount?.toLocaleString() || '0',
            inline: true,
          },
        ],
        url: post.tiktokUrl,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'ViralSense Notification',
        },
      };

      // Add thumbnail if cover image exists
      if (post.coverId) {
        // We'll need to resolve the cover URL later
        // For now, we'll skip the thumbnail
      }

      // Send to Discord (non-blocking)
      await this.sendToDiscord(embed);

      console.log(`✅ High views notification sent for post ${post.id}`);
    } catch (error) {
      console.error('Failed to send high views notification:', error);
      // Don't throw - we don't want to break the main flow
    }
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(): Promise<number> {
    const count = await prisma.notification.count({
      where: {
        read: false,
      },
    });

    return count;
  }

  /**
   * Get recent unread notifications
   */
  async getUnreadNotifications(limit: number = 10) {
    const notifications = await prisma.notification.findMany({
      where: {
        read: false,
      },
      include: {
        post: {
          select: {
            tiktokUrl: true,
            title: true,
            description: true,
            coverId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications;
  }

  /**
   * Get all notifications (paginated)
   */
  async getNotifications(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        include: {
          post: {
            select: {
              tiktokUrl: true,
              title: true,
              description: true,
              coverId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.notification.count(),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string) {
    try {
      const notification = await prisma.notification.update({
        where: { id },
        data: { read: true },
      });

      return notification;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const result = await prisma.notification.updateMany({
        where: { read: false },
        data: { read: true },
      });

      return result;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
