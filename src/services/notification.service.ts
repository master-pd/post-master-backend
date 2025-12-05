import Notification from '../models/Notification.model';
import { sendEmail, emailTemplates } from '../config/email';
import { logger } from '../utils/logger';

export class NotificationService {
  // Create a notification
  static async createNotification(data: {
    recipient: string;
    sender?: string;
    type: string;
    data: any;
  }): Promise<any> {
    return await Notification.create(data);
  }

  // Create like notification
  static async createLikeNotification(
    recipient: string,
    sender: string,
    videoId: string,
    senderUsername: string
  ): Promise<void> {
    await this.createNotification({
      recipient,
      sender,
      type: 'like',
      data: {
        video: videoId,
        message: `${senderUsername} liked your video`
      }
    });
  }

  // Create comment notification
  static async createCommentNotification(
    recipient: string,
    sender: string,
    videoId: string,
    commentId: string,
    senderUsername: string,
    isReply: boolean = false
  ): Promise<void> {
    await this.createNotification({
      recipient,
      sender,
      type: 'comment',
      data: {
        video: videoId,
        comment: commentId,
        message: isReply 
          ? `${senderUsername} replied to your comment`
          : `${senderUsername} commented on your video`
      }
    });
  }

  // Create follow notification
  static async createFollowNotification(
    recipient: string,
    sender: string,
    senderUsername: string
  ): Promise<void> {
    await this.createNotification({
      recipient,
      sender,
      type: 'follow',
      data: {
        message: `${senderUsername} started following you`
      }
    });
  }

  // Create mention notification
  static async createMentionNotification(
    recipient: string,
    sender: string,
    videoId: string,
    commentId: string,
    senderUsername: string
  ): Promise<void> {
    await this.createNotification({
      recipient,
      sender,
      type: 'mention',
      data: {
        video: videoId,
        comment: commentId,
        message: `${senderUsername} mentioned you in a comment`
      }
    });
  }

  // Get user notifications
  static async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<any> {
    const notifications = await Notification.findByRecipient(
      userId,
      page,
      limit,
      unreadOnly
    );

    const total = await Notification.countDocuments({
      recipient: userId,
      ...(unreadOnly && { read: false })
    });

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false
    });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  }

  // Mark notifications as read
  static async markAsRead(notificationIds: string[]): Promise<void> {
    await Notification.markAsRead(notificationIds);
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string): Promise<void> {
    await Notification.markAllAsRead(userId);
  }

  // Delete notification
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId
    });

    return !!result;
  }

  // Clear all notifications
  static async clearAllNotifications(userId: string): Promise<void> {
    await Notification.deleteMany({ recipient: userId });
  }

  // Send email notification
  static async sendEmailNotification(
    recipientEmail: string,
    recipientName: string,
    type: string,
    data: any
  ): Promise<boolean> {
    let subject = '';
    let message = '';

    switch (type) {
      case 'like':
        subject = 'New Like on Your Video';
        message = `${data.senderUsername} liked your video "${data.videoTitle}"`;
        break;
      case 'comment':
        subject = 'New Comment on Your Video';
        message = `${data.senderUsername} commented on your video "${data.videoTitle}"`;
        break;
      case 'follow':
        subject = 'New Follower';
        message = `${data.senderUsername} started following you`;
        break;
      case 'mention':
        subject = 'You Were Mentioned';
        message = `${data.senderUsername} mentioned you in a comment`;
        break;
      default:
        return false;
    }

    return await sendEmail(
      recipientEmail,
      subject,
      emailTemplates.notification(recipientName, message, data.actionLink).html
    );
  }

  // Process batch notifications
  static async processBatchNotifications(notifications: any[]): Promise<void> {
    for (const notification of notifications) {
      try {
        // Here you could implement:
        // 1. Aggregation of similar notifications
        // 2. Rate limiting
        // 3. Priority queuing
        // 4. Delivery to different channels (email, push, in-app)
        
        logger.info(`Processing notification: ${notification.type} for user ${notification.recipient}`);
      } catch (error) {
        logger.error(`Failed to process notification:`, error);
      }
    }
  }

  // Get notification statistics
  static async getNotificationStats(userId: string): Promise<any> {
    const stats = await Notification.aggregate([
      { $match: { recipient: userId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
          }
        }
      }
    ]);

    const total = await Notification.countDocuments({ recipient: userId });
    const unreadTotal = await Notification.countDocuments({ 
      recipient: userId, 
      read: false 
    });

    return {
      total,
      unreadTotal,
      byType: stats
    };
  }
}