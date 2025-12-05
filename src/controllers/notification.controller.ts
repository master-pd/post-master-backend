import { Response } from 'express';
import Notification from '../models/Notification.model';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';

// @desc    Get user notifications
// @route   GET /api/v1/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const unreadOnly = req.query.unread === 'true';

  const notifications = await Notification.findByRecipient(
    req.user._id,
    page,
    limit,
    unreadOnly
  );

  const total = await Notification.countDocuments({
    recipient: req.user._id,
    ...(unreadOnly && { read: false })
  });

  res.status(200).json({
    success: true,
    data: {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount: unreadOnly ? total : await Notification.countDocuments({
        recipient: req.user._id,
        read: false
      })
    }
  });
});

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findOne({
    _id: id,
    recipient: req.user._id
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  notification.read = true;
  await notification.save();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read'
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.markAllAsRead(req.user._id);

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// @desc    Delete notification
// @route   DELETE /api/v1/notifications/:id
// @access  Private
export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndDelete({
    _id: id,
    recipient: req.user._id
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

// @desc    Clear all notifications
// @route   DELETE /api/v1/notifications/clear-all
// @access  Private
export const clearAllNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  await Notification.deleteMany({ recipient: req.user._id });

  res.status(200).json({
    success: true,
    message: 'All notifications cleared'
  });
});

// @desc    Get notification settings
// @route   GET /api/v1/notifications/settings
// @access  Private
export const getNotificationSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  // This would typically come from user settings
  // For now, return default settings
  res.status(200).json({
    success: true,
    data: {
      settings: {
        email: true,
        push: true,
        inApp: true,
        types: {
          likes: true,
          comments: true,
          follows: true,
          mentions: true,
          shares: true,
          newVideos: true,
          system: true
        }
      }
    }
  });
});

// @desc    Update notification settings
// @route   PUT /api/v1/notifications/settings
// @access  Private
export const updateNotificationSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { settings } = req.body;

  // Update user's notification settings
  const user = req.user;
  if (user.settings) {
    user.settings.notifications = settings;
    await user.save();
  }

  res.status(200).json({
    success: true,
    message: 'Notification settings updated successfully',
    data: { settings }
  });
});