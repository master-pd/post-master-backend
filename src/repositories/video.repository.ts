import { prisma } from '../config/database';
import { Prisma, Video, VideoStatus, Category } from '@prisma/client';

export class VideoRepository {
  // Create video
  static async create(videoData: {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
    size: number;
    format: string;
    userId: string;
    tags?: string[];
    category?: Category;
    isPublic?: boolean;
    isCommentsEnabled?: boolean;
    isDownloadable?: boolean;
    width?: number;
    height?: number;
    aspectRatio?: string;
    frameRate?: number;
    bitrate?: number;
  }): Promise<Video> {
    return await prisma.video.create({
      data: {
        title: videoData.title,
        description: videoData.description || '',
        videoUrl: videoData.videoUrl,
        thumbnailUrl: videoData.thumbnailUrl,
        duration: videoData.duration,
        size: videoData.size,
        format: videoData.format,
        userId: videoData.userId,
        tags: videoData.tags || [],
        category: videoData.category || 'OTHER',
        isPublic: videoData.isPublic ?? true,
        isCommentsEnabled: videoData.isCommentsEnabled ?? true,
        isDownloadable: videoData.isDownloadable ?? false,
        width: videoData.width,
        height: videoData.height,
        aspectRatio: videoData.aspectRatio,
        frameRate: videoData.frameRate,
        bitrate: videoData.bitrate,
        status: 'PROCESSING',
        processingProgress: 0,
        uploadedAt: new Date(),
      },
    });
  }

  // Find by ID
  static async findById(id: string, includeRelations: boolean = false): Promise<Video | null> {
    return await prisma.video.findUnique({
      where: { id },
      include: includeRelations ? {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePicture: true,
          },
        },
        likes: {
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        comments: {
          take: 10,
          where: { parentCommentId: null },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
              },
            },
            replies: {
              take: 3,
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    profilePicture: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            views: true,
            savedBy: true,
          },
        },
      } : undefined,
    });
  }

  // Update video
  static async update(
    id: string, 
    data: Partial<Omit<Video, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Video> {
    return await prisma.video.update({
      where: { id },
      data,
    });
  }

  // Delete video
  static async delete(id: string): Promise<Video> {
    return await prisma.video.delete({
      where: { id },
    });
  }

  // Get videos by user
  static async findByUser(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    includePrivate: boolean = false
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const where: any = {
      userId,
      status: 'READY',
    };
    
    if (!includePrivate) {
      where.isPublic = true;
    }

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Get trending videos
  static async getTrending(
    page: number = 1, 
    limit: number = 12,
    days: number = 7
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;
    const date = new Date();
    date.setDate(date.getDate() - days);

    const where = {
      isPublic: true,
      status: 'READY',
      publishedAt: {
        gte: date,
      },
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            likes: {
              _count: 'desc',
            },
          },
          {
            views: {
              _count: 'desc',
            },
          },
          {
            createdAt: 'desc',
          },
        ],
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Get latest videos
  static async getLatest(
    page: number = 1, 
    limit: number = 12
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = {
      isPublic: true,
      status: 'READY',
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          publishedAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Search videos
  static async search(
    query: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = {
      isPublic: true,
      status: 'READY',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { has: query.toLowerCase() } },
      ],
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          publishedAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Get videos by category
  static async findByCategory(
    category: Category, 
    page: number = 1, 
    limit: number = 12
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = {
      isPublic: true,
      status: 'READY',
      category,
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          publishedAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Get videos by tags
  static async findByTags(
    tags: string[], 
    page: number = 1, 
    limit: number = 12
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = {
      isPublic: true,
      status: 'READY',
      tags: {
        hasSome: tags,
      },
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          publishedAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Increment views
  static async incrementViews(videoId: string, userId?: string, ipAddress?: string): Promise<void> {
    // Create view record
    await prisma.view.create({
      data: {
        videoId,
        userId,
        ipAddress,
        userAgent: undefined, // You can add user agent if needed
      },
    });
  }

  // Like/Unlike video
  static async toggleLike(videoId: string, userId: string): Promise<boolean> {
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });
      return false;
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId,
          videoId,
        },
      });
      return true;
    }
  }

  // Save/Unsave video
  static async toggleSave(videoId: string, userId: string): Promise<boolean> {
    const existingSave = await prisma.savedVideo.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });

    if (existingSave) {
      // Unsave
      await prisma.savedVideo.delete({
        where: {
          id: existingSave.id,
        },
      });
      return false;
    } else {
      // Save
      await prisma.savedVideo.create({
        data: {
          userId,
          videoId,
        },
      });
      return true;
    }
  }

  // Check if user liked video
  static async isLiked(videoId: string, userId: string): Promise<boolean> {
    const like = await prisma.like.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });
    
    return !!like;
  }

  // Check if user saved video
  static async isSaved(videoId: string, userId: string): Promise<boolean> {
    const saved = await prisma.savedVideo.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });
    
    return !!saved;
  }

  // Get video statistics
  static async getStats(videoId: string): Promise<{
    likes: number;
    comments: number;
    views: number;
    saves: number;
    shares: number;
  }> {
    const [
      likes,
      comments,
      views,
      saves,
      shares,
    ] = await Promise.all([
      prisma.like.count({ where: { videoId } }),
      prisma.comment.count({ where: { videoId } }),
      prisma.view.count({ where: { videoId } }),
      prisma.savedVideo.count({ where: { videoId } }),
      prisma.share.count({ where: { videoId } }),
    ]);

    return { likes, comments, views, saves, shares };
  }

  // Get user's liked videos
  static async getLikedVideos(
    userId: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = {
      likes: {
        some: {
          userId,
        },
      },
      isPublic: true,
      status: 'READY',
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Get user's saved videos
  static async getSavedVideos(
    userId: string, 
    page: number = 1, 
    limit: number = 12
  ): Promise<{ videos: Video[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = {
      savedBy: {
        some: {
          userId,
        },
      },
      isPublic: true,
      status: 'READY',
    };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              views: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  // Update video processing status
  static async updateProcessingStatus(
    videoId: string, 
    status: VideoStatus, 
    progress: number = 100
  ): Promise<Video> {
    const data: any = {
      status,
      processingProgress: progress,
    };

    if (status === 'READY') {
      data.publishedAt = new Date();
    }

    return await prisma.video.update({
      where: { id: videoId },
      data,
    });
  }
}