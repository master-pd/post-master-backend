import Video from '../models/Video.model';
import User from '../models/User.model';

export class FeedService {
  // Get personalized feed
  static async getPersonalizedFeed(
    userId: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Get users that the current user is following
    const user = await User.findById(userId).select('following');
    const followingIds = user?.following || [];

    // If user is not following anyone, show trending videos
    if (followingIds.length === 0) {
      return this.getTrendingFeed(page, limit, userId);
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
      const trendingVideos = await this.getTrendingVideos(
        1, 
        remainingLimit, 
        [...followingIds, userId]
      );

      supplementedVideos = [...videos, ...trendingVideos];
      supplementedTotal = total + trendingVideos.length;
    }

    return {
      videos: supplementedVideos,
      pagination: {
        page,
        limit,
        total: supplementedTotal,
        pages: Math.ceil(supplementedTotal / limit)
      },
      feedType: 'following'
    };
  }

  // Get trending feed
  static async getTrendingFeed(
    page: number = 1, 
    limit: number = 12,
    excludeUserId?: string
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query: any = {
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo }
    };

    if (excludeUserId) {
      query.user = { $ne: excludeUserId };
    }

    const videos = await Video.find(query)
      .sort({ likes: -1, views: -1 })
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
      },
      feedType: 'trending'
    };
  }

  // Get trending videos
  static async getTrendingVideos(
    page: number = 1, 
    limit: number = 12,
    excludeUserIds: string[] = []
  ): Promise<any[]> {
    const skip = (page - 1) * limit;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query: any = {
      isPublic: true,
      status: 'ready',
      publishedAt: { $gte: weekAgo }
    };

    if (excludeUserIds.length > 0) {
      query.user = { $nin: excludeUserIds };
    }

    const videos = await Video.find(query)
      .sort({ likes: -1, views: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username profilePicture fullName');

    return videos;
  }

  // Get recommended videos based on user preferences
  static async getRecommendedVideos(
    userId: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Get user's liked videos categories and tags
    const user = await User.findById(userId).populate({
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
      user: { $ne: userId }, // Don't recommend user's own videos
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
      user: { $ne: userId },
      $or: [
        { category: mostCommonCategory },
        { tags: { $in: likedTags.slice(0, 5) } }
      ]
    });

    return {
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
  }

  // Get following users' latest activity
  static async getFollowingActivity(
    userId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).select('following');
    const followingIds = user?.following || [];

    if (followingIds.length === 0) {
      return {
        activities: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      };
    }

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

    const total = await Video.countDocuments({
      user: { $in: followingIds },
      isPublic: true,
      status: 'ready'
    });

    // Transform videos into activities
    const activities = videos.map(video => ({
      type: 'new_video',
      user: video.user,
      data: video,
      timestamp: video.publishedAt
    }));

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}