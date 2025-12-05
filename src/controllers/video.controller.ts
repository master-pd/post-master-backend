import { Response } from 'express';
import Video from '../models/Video.model';
import User from '../models/User.model';
import Comment from '../models/Comment.model';
import Notification from '../models/Notification.model';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { deleteFromCloudinary } from '../config/cloudinary';
import { logger } from '../utils/logger';
import { getCache, setCache, deleteCache, clearPattern } from '../config/redis';

// @desc    Upload video
// @route   POST /api/v1/videos/upload
// @access  Private
export const uploadVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a video file');
  }

  const { 
    title, 
    description, 
    tags, 
    category, 
    isPublic = true,
    isCommentsEnabled = true,
    isDownloadable = false 
  } = req.body;

  // Get video file information
  const videoFile = req.file as Express.Multer.File & { location?: string; duration?: number; size?: number };

  // Parse tags if provided as string
  let parsedTags: string[] = [];
  if (tags) {
    if (typeof tags === 'string') {
      parsedTags = tags.split(',').map((tag: string) => tag.trim().toLowerCase()).slice(0, 20);
    } else if (Array.isArray(tags)) {
      parsedTags = tags.map(tag => tag.trim().toLowerCase()).slice(0, 20);
    }
  }

  // Create video document
  const video = await Video.create({
    title,
    description: description || '',
    videoUrl: videoFile.location || videoFile.path,
    thumbnailUrl: req.body.thumbnailUrl || videoFile.location?.replace(/\.(mp4|mov|avi|flv|webm)$/, '.jpg') || '',
    duration: videoFile.duration || 0,
    size: videoFile.size || 0,
    format: videoFile.mimetype.split('/')[1] || 'mp4',
    user: req.user._id,
    tags: parsedTags,
    category: category || 'other',
    isPublic,
    isCommentsEnabled,
    isDownloadable,
    status: 'processing',
    processingProgress: 0,
    uploadedAt: new Date()
  });

  // Update user's posts array
  await User.findByIdAndUpdate(req.user._id, {
    $push: { posts: video._id }
  });

  // Clear cache for user's videos
  await clearPattern(`videos:user:${req.user._id}:*`);
  await clearPattern('videos:trending:*');
  await clearPattern('videos:latest:*');

  // Simulate video processing (in real app, this would be done by a worker)
  setTimeout(async () => {
    try {
      await Video.findByIdAndUpdate(video._id, {
        status: 'ready',
        processingProgress: 100,
        publishedAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to update video status:', error);
    }
  }, 5000); // Simulate 5 seconds processing

  res.status(201).json({
    success: true,
    message: 'Video uploaded successfully. Processing started.',
    data: {
      video: {
        id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        status: video.status,
        processingProgress: video.processingProgress
      }
    }
  });
});

// @desc    Get video by ID
// @route   GET /api/v1/videos/:id
// @access  Public (or Private based on video settings)
export const getVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?._id;

  // Try cache first
  const cacheKey = `video:${id}`;
  const cachedVideo = await getCache(cacheKey);
  
  if (cachedVideo) {
    // Check video privacy
    if (!cachedVideo.isPublic && cachedVideo.user._id !== currentUserId?.toString()) {
      res.status(403);
      throw new Error('This video is private');
    }
    
    // Increment views
    cachedVideo.views += 1;
    setCache(cacheKey, cachedVideo, 3600); // Update cache
    
    return res.status(200).json({
      success: true,
      data: { video: cachedVideo }
    });
  }

  // If not in cache, fetch from database
  const video = await Video.findById(id)
    .populate('user', 'username profilePicture fullName followers')
    .populate('comments');

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  // Check video privacy
  if (!video.isPublic && video.user._id.toString() !== currentUserId?.toString()) {
    res.status(403);
    throw new Error('This video is private');
  }

  // Increment views
  await video.incrementViews();

  // Cache the video
  const videoData = video.toObject();
  await setCache(cacheKey, videoData, 3600); // Cache for 1 hour

  res.status(200).json({
    success: true,
    data: { video: videoData }
  });
});

// @desc    Update video
// @route   PUT /api/v1/videos/:id
// @access  Private (video owner or admin)
export const updateVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { 
    title, 
    description, 
    tags, 
    category,
    isPublic,
    isCommentsEnabled,
    isDownloadable 
  } = req.body;

  const video = await Video.findById(id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  // Check ownership or admin role
  if (video.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update this video');
  }

  // Parse tags if provided
  let parsedTags = video.tags;
  if (tags !== undefined) {
    if (typeof tags === 'string') {
      parsedTags = tags.split(',').map((tag: string) => tag.trim().toLowerCase()).slice(0, 20);
    } else if (Array.isArray(tags)) {
      parsedTags = tags.map(tag => tag.trim().toLowerCase()).slice(0, 20);
    }
  }

  // Update video
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (tags !== undefined) updateData.tags = parsedTags;
  if (category !== undefined) updateData.category = category;
  if (isPublic !== undefined) updateData.isPublic = isPublic;
  if (isCommentsEnabled !== undefined) updateData.isCommentsEnabled = isCommentsEnabled;
  if (isDownloadable !== undefined) updateData.isDownloadable = isDownloadable;

  const updatedVideo = await Video.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('user', 'username profilePicture fullName');

  // Clear cache
  await deleteCache(`video:${id}`);
  await clearPattern(`videos:user:${video.user}:*`);
  await clearPattern('videos:trending:*');

  res.status(200).json({
    success: true,
    message: 'Video updated successfully',
    data: { video: updatedVideo }
  });
});

// @desc    Delete video
// @route   DELETE /api/v1/videos/:id
// @access  Private (video owner or admin)
export const deleteVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const video = await Video.findById(id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  // Check ownership or admin role
  if (video.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
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

  // Clear cache
  await deleteCache(`video:${id}`);
  await clearPattern(`videos:user:${video.user}:*`);
  await clearPattern('videos:trending:*');
  await clearPattern('videos:latest:*');

  res.status(200).json({
    success: true,
    message: 'Video deleted successfully'
  });
});

// @desc    Like/Unlike video
// @route   POST /api/v1/videos/:id/like
// @access  Private
export const toggleLike = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const video = await Video.findById(id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  if (!video.isPublic && video.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('This video is private');
  }

  // Toggle like
  const liked = await video.toggleLike(req.user._id);

  // Update user's liked posts
  const user = await User.findById(req.user._id);
  if (user) {
    if (liked) {
      user.likedPosts.push(video._id);
      
      // Create notification for video owner (if not the same user)
      if (video.user.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: video.user,
          sender: req.user._id,
          type: 'like',
          data: {
            video: video._id,
            message: `${user.username} liked your video`
          }
        });
      }
    } else {
      user.likedPosts = user.likedPosts.filter(
        postId => postId.toString() !== video._id.toString()
      );
    }
    await user.save();
  }

  // Clear cache
  await deleteCache(`video:${id}`);
  await clearPattern(`videos:user:${video.user}:*`);

  res.status(200).json({
    success: true,
    message: liked ? 'Video liked' : 'Video unliked',
    data: {
      likes: video.likes.length,
      liked
    }
  });
});

// @desc    Save/Unsave video
// @route   POST /api/v1/videos/:id/save
// @access  Private
export const toggleSave = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const video = await Video.findById(id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  if (!video.isPublic && video.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('This video is private');
  }

  const user = await User.findById(req.user._id);
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
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

  res.status(200).json({
    success: true,
    message: isSaved ? 'Video unsaved' : 'Video saved',
    data: {
      saved: !isSaved
    }
  });
});

// @desc    Get video comments
// @route   GET /api/v1/videos/:id/comments
// @access  Public
export const getVideoComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const video = await Video.findById(id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  if (!video.isPublic && (!req.user || video.user.toString() !== req.user._id.toString())) {
    res.status(403);
    throw new Error('This video is private');
  }

  if (!video.isCommentsEnabled) {
    return res.status(200).json({
      success: true,
      data: {
        comments: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      }
    });
  }

  const comments = await Comment.findByVideoId(id, page, limit);
  const total = await Comment.countDocuments({ video: id, parentComment: null });

  res.status(200).json({
    success: true,
    data: {
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get trending videos
// @route   GET /api/v1/videos/trending
// @access  Public
export const getTrendingVideos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  
  // Try cache first
  const cacheKey = `videos:trending:${page}:${limit}`;
  const cachedVideos = await getCache(cacheKey);
  
  if (cachedVideos) {
    return res.status(200).json({
      success: true,
      data: cachedVideos
    });
  }

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

  const response = {
    videos,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };

  // Cache for 10 minutes
  await setCache(cacheKey, response, 600);

  res.status(200).json({
    success: true,
    data: response
  });
});

// @desc    Get latest videos
// @route   GET /api/v1/videos/latest
// @access  Public
export const getLatestVideos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  
  // Try cache first
  const cacheKey = `videos:latest:${page}:${limit}`;
  const cachedVideos = await getCache(cacheKey);
  
  if (cachedVideos) {
    return res.status(200).json({
      success: true,
      data: cachedVideos
    });
  }

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

  const response = {
    videos,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };

  // Cache for 5 minutes
  await setCache(cacheKey, response, 300);

  res.status(200).json({
    success: true,
    data: response
  });
});

// @desc    Search videos
// @route   GET /api/v1/videos/search
// @access  Public
export const searchVideos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  if (!q || typeof q !== 'string') {
    res.status(400);
    throw new Error('Search query is required');
  }

  // Try cache first
  const cacheKey = `videos:search:${q}:${page}:${limit}`;
  const cachedVideos = await getCache(cacheKey);
  
  if (cachedVideos) {
    return res.status(200).json({
      success: true,
      data: cachedVideos
    });
  }

  const videos = await Video.find({
    $text: { $search: q },
    isPublic: true,
    status: 'ready'
  })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');

  const total = await Video.countDocuments({
    $text: { $search: q },
    isPublic: true,
    status: 'ready'
  });

  const response = {
    videos,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };

  // Cache for 2 minutes
  await setCache(cacheKey, response, 120);

  res.status(200).json({
    success: true,
    data: response
  });
});