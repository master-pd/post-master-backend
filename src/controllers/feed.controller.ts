import { Response } from 'express';
import Video from '../models/Video.model';
import User from '../models/User.model';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCache, setCache } from '../config/redis';

// @desc    Get personalized feed for logged-in user
// @route   GET /api/v1/feed
// @access  Private
export const getFeed = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  
  // Try cache first
  const cacheKey = `feed:${req.user._id}:${page}:${limit}`;
  const cachedFeed = await getCache(cacheKey);
  
  if (cachedFeed) {
    return res.status(200).json({
      success: true,
      data: cachedFeed
    });
  }

  const skip = (page - 1) * limit;

  // Get users that the current user is following
  const user = await User.findById(req.user._id).select('following');
  const followingIds = user?.following || [];

  // If user is not following anyone, show trending videos
  if (followingIds.length === 0) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const videos = await Video.find({
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo },
      user: { $ne: req.user._id } // Don't show user's own videos
    })
      .sort({ likes: -1, views: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    const total = await Video.countDocuments({
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo },
      user: { $ne: req.user._id }
    });

    const response = {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      feedType: 'trending'
    };

    // Cache for 5 minutes
    await setCache(cacheKey, response, 300);

    return res.status(200).json({
      success: true,
      data: response
    });
  }

  // Get videos from followed users
  const videos = await Video.find({
    user: { $in: followingIds },
    isPublic: true,
    status: 'ready'
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');

  const total = await Video.countDocuments({
    user: { $in: followingIds },
    isPublic: true,
    status: 'ready'
  });

  // If not enough videos from followed users, supplement with trending videos
  let supplementedVideos = [...videos];
  let supplementedTotal = total;

  if (videos.length < limit) {
    const remainingLimit = limit - videos.length;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const trendingVideos = await Video.find({
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo },
      user: { 
        $nin: [...followingIds, req.user._id] // Don't include followed users or self
      }
    })
      .sort({ likes: -1, views: -1 })
      .limit(remainingLimit)
      .populate('user', 'username profilePicture fullName');

    supplementedVideos = [...videos, ...trendingVideos];
    supplementedTotal = total + await Video.countDocuments({
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo },
      user: { 
        $nin: [...followingIds, req.user._id]
      }
    });
  }

  const response = {
    videos: supplementedVideos,
    pagination: {
      page,
      limit,
      total: supplementedTotal,
      pages: Math.ceil(supplementedTotal / limit)
    },
    feedType: followingIds.length > 0 ? 'following' : 'trending'
  };

  // Cache for 2 minutes
  await setCache(cacheKey, response, 120);

  res.status(200).json({
    success: true,
    data: response
  });
});

// @desc    Get videos by category
// @route   GET /api/v1/feed/category/:category
// @access  Public
export const getCategoryFeed = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { category } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;

  const validCategories = [
    'entertainment', 'education', 'sports', 'music', 
    'gaming', 'comedy', 'lifestyle', 'news', 'other'
  ];

  if (!validCategories.includes(category)) {
    res.status(400);
    throw new Error(`Invalid category. Valid categories are: ${validCategories.join(', ')}`);
  }

  // Try cache first
  const cacheKey = `feed:category:${category}:${page}:${limit}`;
  const cachedFeed = await getCache(cacheKey);
  
  if (cachedFeed) {
    return res.status(200).json({
      success: true,
      data: cachedFeed
    });
  }

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

  const response = {
    videos,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    category
  };

  // Cache for 5 minutes
  await setCache(cacheKey, response, 300);

  res.status(200).json({
    success: true,
    data: response
  });
});

// @desc    Get videos by tag
// @route   GET /api/v1/feed/tag/:tag
// @access  Public
export const getTagFeed = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { tag } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;

  if (!tag) {
    res.status(400);
    throw new Error('Tag is required');
  }

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

  res.status(200).json({
    success: true,
    data: {
      videos,
      tag,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get recommended videos
// @route   GET /api/v1/feed/recommended
// @access  Private
export const getRecommendedVideos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;

  // Try cache first
  const cacheKey = `feed:recommended:${req.user._id}:${page}:${limit}`;
  const cachedFeed = await getCache(cacheKey);
  
  if (cachedFeed) {
    return res.status(200).json({
      success: true,
      data: cachedFeed
    });
  }

  const skip = (page - 1) * limit;

  // Get user's liked videos categories and tags
  const user = await User.findById(req.user._id).populate({
    path: 'likedPosts',
    select: 'category tags'
  });

  // Extract preferred categories and tags
  const likedCategories = user?.likedPosts?.map((video: any) => video.category) || [];
  const likedTags = user?.likedPosts?.flatMap((video: any) => video.tags) || [];

  // Find most common category
  const categoryCounts: Record<string, number> = {};
  likedCategories.forEach((category: string) => {
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  const mostCommonCategory = Object.keys(categoryCounts).length > 0
    ? Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b)
    : 'entertainment'; // Default category

  // Find videos in preferred category or with preferred tags
  const recommendedVideos = await Video.find({
    isPublic: true,
    status: 'ready',
    user: { $ne: req.user._id }, // Don't recommend user's own videos
    $or: [
      { category: mostCommonCategory },
      { tags: { $in: likedTags.slice(0, 5) } } // Top 5 liked tags
    ]
  })
    .sort({ likes: -1, views: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');

  const total = await Video.countDocuments({
    isPublic: true,
    status: 'ready',
    user: { $ne: req.user._id },
    $or: [
      { category: mostCommonCategory },
      { tags: { $in: likedTags.slice(0, 5) } }
    ]
  });

  const response = {
    videos: recommendedVideos,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    recommendationBasedOn: {
      category: mostCommonCategory,
      tags: likedTags.slice(0, 5)
    }
  };

  // Cache for 10 minutes
  await setCache(cacheKey, response, 600);

  res.status(200).json({
    success: true,
    data: response
  });
});

// @desc    Get following users' latest activity
// @route   GET /api/v1/feed/following-activity
// @access  Private
export const getFollowingActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const user = await User.findById(req.user._id).select('following');
  const followingIds = user?.following || [];

  if (followingIds.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        activities: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      }
    });
  }

  const skip = (page - 1) * limit;

  // Get latest videos from followed users
  const videos = await Video.find({
    user: { $in: followingIds },
    isPublic: true,
    status: 'ready'
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName')
    .select('title thumbnailUrl publishedAt');

  // Get recent follows from followed users
  const recentFollows = await User.find({
    _id: { $in: followingIds }
  })
    .select('username profilePicture')
    .slice('followers', -5) // Get last 5 followers
    .populate({
      path: 'followers',
      select: 'username profilePicture',
      options: { limit: 5 }
    });

  const activities = [
    ...videos.map(video => ({
      type: 'new_video',
      user: video.user,
      data: video,
      timestamp: video.publishedAt
    })),
    ...recentFollows.flatMap(user => 
      user.followers?.map((follower: any) => ({
        type: 'new_follower',
        user: follower,
        data: { followedUser: user },
        timestamp: new Date() // In real app, store when follow happened
      })) || []
    )
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
   .slice(0, limit);

  const total = await Video.countDocuments({
    user: { $in: followingIds },
    isPublic: true,
    status: 'ready'
  });

  res.status(200).json({
    success: true,
    data: {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});