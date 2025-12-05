import Video from '../models/Video.model';
import User from '../models/User.model';
import Comment from '../models/Comment.model';
import { deleteFromCloudinary } from '../config/cloudinary';
import { logger } from '../utils/logger';

export class VideoService {
  // Get video by ID with caching
  static async getVideoById(
    videoId: string, 
    currentUserId?: string
  ): Promise<any> {
    const video = await Video.findById(videoId)
      .populate('user', 'username profilePicture fullName followers')
      .populate('comments');

    if (!video) {
      throw new Error('Video not found');
    }

    // Check video privacy
    if (!video.isPublic && video.user._id.toString() !== currentUserId) {
      throw new Error('This video is private');
    }

    // Increment views
    await video.incrementViews();

    return video;
  }

  // Get videos by user
  static async getVideosByUser(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    currentUserId?: string
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const query: any = { user: userId, status: 'ready' };
    
    // If not the current user, only show public videos
    if (userId !== currentUserId) {
      query.isPublic = true;
    }

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments(query);

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get trending videos
  static async getTrendingVideos(
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const videos = await Video.find({
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo }
    })
      .sort({ likes: -1, views: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments({
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo }
    });

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get latest videos
  static async getLatestVideos(
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const videos = await Video.find({
      isPublic: true,
      status: 'ready'
    })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments({
      isPublic: true,
      status: 'ready'
    });

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Search videos
  static async searchVideos(
    query: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const videos = await Video.find({
      $text: { $search: query },
      isPublic: true,
      status: 'ready'
    })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments({
      $text: { $search: query },
      isPublic: true,
      status: 'ready'
    });

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Like/Unlike video
  static async toggleLike(
    videoId: string, 
    userId: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new Error('Video not found');
    }

    const liked = await video.toggleLike(userId);

    // Update user's liked posts
    const user = await User.findById(userId);
    if (user) {
      if (liked) {
        user.likedPosts.push(video._id);
      } else {
        user.likedPosts = user.likedPosts.filter(
          postId => postId.toString() !== video._id.toString()
        );
      }
      await user.save();
    }

    return {
      liked,
      likeCount: video.likes.length
    };
  }

  // Save/Unsave video
  static async toggleSave(
    videoId: string, 
    userId: string
  ): Promise<{ saved: boolean }> {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const video = await Video.findById(videoId);
    
    if (!video) {
      throw new Error('Video not found');
    }

    if (!video.isPublic && video.user.toString() !== userId) {
      throw new Error('This video is private');
    }

    // Check if video is already saved
    const isSaved = user.savedPosts.includes(video._id);

    if (isSaved) {
      // Unsave
      user.savedPosts = user.savedPosts.filter(
        postId => postId.toString() !== video._id.toString()
      );
    } else {
      // Save
      user.savedPosts.push(video._id);
    }

    await user.save();

    return {
      saved: !isSaved
    };
  }

  // Update video
  static async updateVideo(
    videoId: string, 
    updateData: any, 
    userId: string,
    userRole: string
  ): Promise<any> {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new Error('Video not found');
    }

    // Check ownership or admin role
    if (video.user.toString() !== userId && userRole !== 'admin') {
      throw new Error('Not authorized to update this video');
    }

    // Parse tags if provided
    if (updateData.tags !== undefined) {
      if (typeof updateData.tags === 'string') {
        updateData.tags = updateData.tags.split(',').map((tag: string) => tag.trim().toLowerCase()).slice(0, 20);
      } else if (Array.isArray(updateData.tags)) {
        updateData.tags = updateData.tags.map((tag: string) => tag.trim().toLowerCase()).slice(0, 20);
      }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'username profilePicture fullName');

    return updatedVideo;
  }

  // Delete video
  static async deleteVideo(
    videoId: string, 
    userId: string,
    userRole: string
  ): Promise<void> {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new Error('Video not found');
    }

    // Check ownership or admin role
    if (video.user.toString() !== userId && userRole !== 'admin') {
      throw new Error('Not authorized to delete this video');
    }

    // Delete from Cloudinary
    try {
      const videoPublicId = video.videoUrl.split('/').pop()?.split('.')[0];
      const thumbnailPublicId = video.thumbnailUrl.split('/').pop()?.split('.')[0];
      
      if (videoPublicId) {
        await deleteFromCloudinary(videoPublicId, 'video');
      }
      if (thumbnailPublicId) {
        await deleteFromCloudinary(thumbnailPublicId, 'image');
      }
    } catch (error) {
      logger.error('Failed to delete video from Cloudinary:', error);
    }

    // Delete video from database
    await video.deleteOne();

    // Remove video from user's posts
    await User.findByIdAndUpdate(video.user, {
      $pull: { posts: video._id }
    });

    // Delete all comments associated with the video
    await Comment.deleteMany({ video: video._id });
  }

  // Get video engagement stats
  static async getVideoStats(videoId: string): Promise<any> {
    const video = await Video.findById(videoId)
      .populate('comments')
      .populate('likes', 'username');

    if (!video) {
      throw new Error('Video not found');
    }

    const comments = await Comment.find({ video: videoId })
      .populate('user', 'username profilePicture')
      .limit(50);

    const engagementRate = video.engagementRate;

    return {
      views: video.views,
      likes: video.likes.length,
      comments: video.comments.length,
      shares: video.shares,
      engagementRate,
      recentComments: comments,
      topLikers: video.likes.slice(0, 10)
    };
  }

  // Get videos by category
  static async getVideosByCategory(
    category: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const videos = await Video.find({
      category,
      isPublic: true,
      status: 'ready'
    })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments({
      category,
      isPublic: true,
      status: 'ready'
    });

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      category
    };
  }

  // Get videos by tags
  static async getVideosByTag(
    tag: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const videos = await Video.find({
      tags: tag.toLowerCase(),
      isPublic: true,
      status: 'ready'
    })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments({
      tags: tag.toLowerCase(),
      isPublic: true,
      status: 'ready'
    });

    return {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      tag
    };
  }
}