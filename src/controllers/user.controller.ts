import { Response } from 'express';
import User from '../models/User.model';
import Video from '../models/Video.model';
import Notification from '../models/Notification.model';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { deleteFromCloudinary } from '../config/cloudinary';
import { logger } from '../utils/logger';
import { sendEmail, emailTemplates } from '../config/email';

// @desc    Get user profile
// @route   GET /api/v1/users/:username
// @access  Public
export const getUserProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { username } = req.params;
  const currentUserId = req.user?._id;

  const user = await User.findOne({ username })
    .select('-password -verificationToken -resetPasswordToken')
    .populate('followers', 'username profilePicture fullName')
    .populate('following', 'username profilePicture fullName');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if account is private
  if (user.settings.privateAccount && user._id.toString() !== currentUserId?.toString()) {
    const isFollowing = user.followers.some(follower => 
      follower._id.toString() === currentUserId?.toString()
    );

    if (!isFollowing) {
      return res.status(200).json({
        success: true,
        data: {
          user: {
            _id: user._id,
            username: user.username,
            profilePicture: user.profilePicture,
            fullName: user.fullName,
            bio: user.bio,
            followerCount: user.followers.length,
            followingCount: user.following.length,
            postCount: user.posts.length,
            isPrivate: true,
            isFollowing: false
          },
          posts: []
        }
      });
    }
  }

  // Get user's videos
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  const videos = await Video.find({ 
    user: user._id, 
    isPublic: true,
    status: 'ready'
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');

  // Check if current user is following this user
  const isFollowing = currentUserId 
    ? user.followers.some(follower => follower._id.toString() === currentUserId.toString())
    : false;

  res.status(200).json({
    success: true,
    data: {
      user: {
        ...user.toObject(),
        isFollowing,
        isPrivate: user.settings.privateAccount
      },
      posts: videos,
      pagination: {
        page,
        limit,
        total: user.posts.length,
        pages: Math.ceil(user.posts.length / limit)
      }
    }
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fullName, bio, username, settings } = req.body;

  // Check if username is being changed and if it's already taken
  if (username && username !== req.user.username) {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.status(400);
      throw new Error('Username already taken');
    }
  }

  // Update user
  const updateData: any = {};
  if (fullName !== undefined) updateData.fullName = fullName;
  if (bio !== undefined) updateData.bio = bio;
  if (username !== undefined) updateData.username = username;
  if (settings !== undefined) updateData.settings = settings;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
});

// @desc    Upload profile picture
// @route   PUT /api/v1/users/profile-picture
// @access  Private
export const uploadProfilePicture = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload an image');
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Delete old profile picture from Cloudinary if exists
  if (user.profilePicture) {
    try {
      const publicId = user.profilePicture.split('/').pop()?.split('.')[0];
      if (publicId) {
        await deleteFromCloudinary(publicId, 'image');
      }
    } catch (error) {
      logger.error('Failed to delete old profile picture:', error);
    }
  }

  // Update user with new profile picture URL
  user.profilePicture = req.file.location || req.file.path;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile picture updated successfully',
    data: { profilePicture: user.profilePicture }
  });
});

// @desc    Upload cover picture
// @route   PUT /api/v1/users/cover-picture
// @access  Private
export const uploadCoverPicture = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload an image');
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Delete old cover picture from Cloudinary if exists
  if (user.coverPicture) {
    try {
      const publicId = user.coverPicture.split('/').pop()?.split('.')[0];
      if (publicId) {
        await deleteFromCloudinary(publicId, 'image');
      }
    } catch (error) {
      logger.error('Failed to delete old cover picture:', error);
    }
  }

  // Update user with new cover picture URL
  user.coverPicture = req.file.location || req.file.path;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Cover picture updated successfully',
    data: { coverPicture: user.coverPicture }
  });
});

// @desc    Follow user
// @route   POST /api/v1/users/:userId/follow
// @access  Private
export const followUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  if (userId === currentUserId.toString()) {
    res.status(400);
    throw new Error('You cannot follow yourself');
  }

  const userToFollow = await User.findById(userId);
  const currentUser = await User.findById(currentUserId);

  if (!userToFollow || !currentUser) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if already following
  const isFollowing = currentUser.following.includes(userToFollow._id);

  if (isFollowing) {
    // Unfollow
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userId
    );
    userToFollow.followers = userToFollow.followers.filter(
      id => id.toString() !== currentUserId.toString()
    );
  } else {
    // Follow
    currentUser.following.push(userToFollow._id);
    userToFollow.followers.push(currentUserId);

    // Create notification for the user being followed
    if (userToFollow.settings.notifications.push) {
      await Notification.create({
        recipient: userToFollow._id,
        sender: currentUserId,
        type: 'follow',
        data: {
          message: `${currentUser.username} started following you`
        }
      });

      // Send email notification if enabled
      if (userToFollow.settings.notifications.email) {
        await sendEmail(
          userToFollow.email,
          emailTemplates.notification(
            userToFollow.fullName || userToFollow.username,
            `${currentUser.username} started following you`,
            `${process.env.FRONTEND_URL}/${currentUser.username}`
          ).subject,
          emailTemplates.notification(
            userToFollow.fullName || userToFollow.username,
            `${currentUser.username} started following you`,
            `${process.env.FRONTEND_URL}/${currentUser.username}`
          ).html
        );
      }
    }
  }

  await Promise.all([currentUser.save(), userToFollow.save()]);

  res.status(200).json({
    success: true,
    message: isFollowing ? 'Unfollowed successfully' : 'Followed successfully',
    data: {
      isFollowing: !isFollowing,
      followerCount: userToFollow.followers.length,
      followingCount: currentUser.following.length
    }
  });
});

// @desc    Get user's followers
// @route   GET /api/v1/users/:userId/followers
// @access  Public
export const getFollowers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId)
    .select('followers')
    .populate({
      path: 'followers',
      select: 'username profilePicture fullName bio',
      options: { skip, limit }
    });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const total = user.followers.length;

  res.status(200).json({
    success: true,
    data: {
      followers: user.followers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get user's following
// @route   GET /api/v1/users/:userId/following
// @access  Public
export const getFollowing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId)
    .select('following')
    .populate({
      path: 'following',
      select: 'username profilePicture fullName bio',
      options: { skip, limit }
    });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const total = user.following.length;

  res.status(200).json({
    success: true,
    data: {
      following: user.following,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get user's liked videos
// @route   GET /api/v1/users/:userId/likes
// @access  Public
export const getLikedVideos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId).select('likedPosts');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const videos = await Video.find({
    _id: { $in: user.likedPosts },
    isPublic: true,
    status: 'ready'
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');

  const total = user.likedPosts.length;

  res.status(200).json({
    success: true,
    data: {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Get user's saved videos
// @route   GET /api/v1/users/:userId/saved
// @access  Private (only own saved videos)
export const getSavedVideos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  
  // Check if user is viewing their own saved videos
  if (userId !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only view your own saved videos');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId).select('savedPosts');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const videos = await Video.find({
    _id: { $in: user.savedPosts },
    isPublic: true,
    status: 'ready'
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profilePicture fullName');

  const total = user.savedPosts.length;

  res.status(200).json({
    success: true,
    data: {
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Search users
// @route   GET /api/v1/users/search
// @access  Public
export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  if (!q || typeof q !== 'string') {
    res.status(400);
    throw new Error('Search query is required');
  }

  const users = await User.find({
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { fullName: { $regex: q, $options: 'i' } }
    ],
    isActive: true
  })
    .select('username profilePicture fullName bio followerCount followingCount')
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments({
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { fullName: { $regex: q, $options: 'i' } }
    ],
    isActive: true
  });

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Deactivate account
// @route   DELETE /api/v1/users/deactivate
// @access  Private
export const deactivateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Soft delete: mark as inactive
  user.isActive = false;
  await user.save();

  // Send notification email
  await sendEmail(
    user.email,
    'Account Deactivated',
    emailTemplates.notification(
      user.fullName || user.username,
      'Your account has been deactivated. You can reactivate it anytime by logging in.',
      `${process.env.FRONTEND_URL}/reactivate`
    ).html
  );

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

// @desc    Reactivate account
// @route   POST /api/v1/users/reactivate
// @access  Public
export const reactivateAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check password
  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Reactivate account
  user.isActive = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Account reactivated successfully'
  });
});