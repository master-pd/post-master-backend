import { Response } from 'express';
import Comment from '../models/Comment.model';
import Video from '../models/Video.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';

// @desc    Create a comment
// @route   POST /api/v1/comments
// @access  Private
export const createComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { content, videoId, parentCommentId } = req.body;

  // Check if video exists and comments are enabled
  const video = await Video.findById(videoId);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  if (!video.isPublic && video.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('This video is private');
  }

  if (!video.isCommentsEnabled) {
    res.status(403);
    throw new Error('Comments are disabled for this video');
  }

  // Check parent comment if replying
  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment || parentComment.video.toString() !== videoId) {
      res.status(400);
      throw new Error('Invalid parent comment');
    }
  }

  // Create comment
  const comment = await Comment.create({
    content,
    user: req.user._id,
    video: videoId,
    parentComment: parentCommentId || null,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }
  });

  // Add comment to video
  video.comments.push(comment._id);
  await video.save();

  // Populate user data
  await comment.populate('user', 'username profilePicture fullName');

  // Create notification for video owner (if not the same user)
  if (video.user.toString() !== req.user._id.toString()) {
    await Notification.create({
      recipient: video.user,
      sender: req.user._id,
      type: 'comment',
      data: {
        video: video._id,
        comment: comment._id,
        message: `${req.user.username} commented on your video`
      }
    });

    // If replying to a comment, notify the parent comment's author
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment && parentComment.user.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: parentComment.user,
          sender: req.user._id,
          type: 'comment',
          data: {
            video: video._id,
            comment: comment._id,
            message: `${req.user.username} replied to your comment`
          }
        });
      }
    }
  }

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: { comment }
  });
});

// @desc    Update a comment
// @route   PUT /api/v1/comments/:id
// @access  Private (comment owner or admin)
export const updateComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Check ownership or admin role
  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update this comment');
  }

  // Check if comment is editable (not too old)
  const hoursSinceCreation = (Date.now() - comment.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    res.status(400);
    throw new Error('Comments can only be edited within 24 hours of creation');
  }

  // Update comment
  comment.content = content;
  comment.isEdited = true;
  comment.editedAt = new Date();
  
  const updatedComment = await comment.save();
  await updatedComment.populate('user', 'username profilePicture fullName');

  res.status(200).json({
    success: true,
    message: 'Comment updated successfully',
    data: { comment: updatedComment }
  });
});

// @desc    Delete a comment
// @route   DELETE /api/v1/comments/:id
// @access  Private (comment owner, video owner, or admin)
export const deleteComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Get video to check ownership
  const video = await Video.findById(comment.video);

  // Check authorization: comment owner, video owner, or admin
  const isCommentOwner = comment.user.toString() === req.user._id.toString();
  const isVideoOwner = video && video.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isCommentOwner && !isVideoOwner && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to delete this comment');
  }

  // If comment has replies, mark as deleted instead of removing
  if (comment.replies.length > 0) {
    comment.content = '[This comment has been deleted]';
    comment.user = null as any; // Remove user reference
    await comment.save();
  } else {
    // Remove comment from video
    if (video) {
      video.comments = video.comments.filter(
        commentId => commentId.toString() !== id
      );
      await video.save();
    }

    // Remove comment from parent comment's replies if it's a reply
    if (comment.parentComment) {
      const parentComment = await Comment.findById(comment.parentComment);
      if (parentComment) {
        parentComment.replies = parentComment.replies.filter(
          replyId => replyId.toString() !== id
        );
        await parentComment.save();
      }
    }

    // Delete the comment
    await comment.deleteOne();
  }

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully'
  });
});

// @desc    Like/Unlike a comment
// @route   POST /api/v1/comments/:id/like
// @access  Private
export const toggleLikeComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Check if user has already liked the comment
  const userIndex = comment.likes.indexOf(req.user._id);

  if (userIndex === -1) {
    // Like the comment
    comment.likes.push(req.user._id);

    // Create notification for comment author (if not the same user)
    if (comment.user && comment.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: comment.user,
        sender: req.user._id,
        type: 'like',
        data: {
          comment: comment._id,
          message: `${req.user.username} liked your comment`
        }
      });
    }
  } else {
    // Unlike the comment
    comment.likes.splice(userIndex, 1);
  }

  await comment.save();

  res.status(200).json({
    success: true,
    message: userIndex === -1 ? 'Comment liked' : 'Comment unliked',
    data: {
      likes: comment.likes.length,
      liked: userIndex === -1
    }
  });
});

// @desc    Get comment replies
// @route   GET /api/v1/comments/:id/replies
// @access  Public
export const getCommentReplies = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  const replies = await Comment.findReplies(id, page, limit);
  const total = comment.replies.length;

  res.status(200).json({
    success: true,
    data: {
      replies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Pin/Unpin a comment (video owner or admin only)
// @route   POST /api/v1/comments/:id/pin
// @access  Private
export const togglePinComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // Get video to check ownership
  const video = await Video.findById(comment.video);

  // Check authorization: video owner or admin
  const isVideoOwner = video && video.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isVideoOwner && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to pin/unpin comments on this video');
  }

  // Toggle pin status
  comment.isPinned = !comment.isPinned;
  comment.pinnedAt = comment.isPinned ? new Date() : undefined;

  await comment.save();

  // If pinning a comment, unpin any other pinned comments on this video
  if (comment.isPinned) {
    await Comment.updateMany(
      {
        video: comment.video,
        _id: { $ne: comment._id },
        isPinned: true
      },
      { 
        $set: { 
          isPinned: false,
          pinnedAt: undefined 
        } 
      }
    );
  }

  res.status(200).json({
    success: true,
    message: comment.isPinned ? 'Comment pinned' : 'Comment unpinned',
    data: {
      isPinned: comment.isPinned
    }
  });
});

// @desc    Report a comment
// @route   POST /api/v1/comments/:id/report
// @access  Private
export const reportComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const comment = await Comment.findById(id);

  if (!comment) {
    res.status(404);
    throw new Error('Comment not found');
  }

  // In a real application, you would:
  // 1. Create a report record in the database
  // 2. Send notification to moderators/admin
  // 3. Possibly auto-hide the comment if multiple reports

  // For now, we'll just log the report
  console.log(`Comment ${id} reported by user ${req.user._id}: ${reason}`);

  res.status(200).json({
    success: true,
    message: 'Comment reported successfully. Our team will review it shortly.'
  });
});