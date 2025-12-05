import express from 'express';
import {
  getUserProfile,
  updateProfile,
  uploadProfilePicture,
  uploadCoverPicture,
  followUser,
  getFollowers,
  getFollowing,
  getLikedVideos,
  getSavedVideos,
  searchUsers,
  deactivateAccount,
  reactivateAccount
} from '../controllers/user.controller';
import {
  userValidation,
  paginationValidation,
  validateRequest
} from '../middlewares/validation.middleware';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import { uploadImageMiddleware, checkFileType } from '../middlewares/upload.middleware';
import { generalLimiter } from '../middlewares/rateLimit.middleware';

const router = express.Router();

// Public routes
router.get(
  '/:username',
  optionalAuthenticate,
  generalLimiter,
  getUserProfile
);

router.get(
  '/:userId/followers',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getFollowers
);

router.get(
  '/:userId/following',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getFollowing
);

router.get(
  '/:userId/likes',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getLikedVideos
);

router.get(
  '/search',
  paginationValidation,
  validateRequest,
  generalLimiter,
  searchUsers
);

// Protected routes
router.put(
  '/profile',
  authenticate,
  userValidation.updateProfile,
  validateRequest,
  updateProfile
);

router.put(
  '/profile-picture',
  authenticate,
  uploadImageMiddleware,
  checkFileType,
  uploadProfilePicture
);

router.put(
  '/cover-picture',
  authenticate,
  uploadImageMiddleware,
  checkFileType,
  uploadCoverPicture
);

router.post(
  '/:userId/follow',
  authenticate,
  generalLimiter,
  followUser
);

router.get(
  '/:userId/saved',
  authenticate,
  paginationValidation,
  validateRequest,
  getSavedVideos
);

router.delete(
  '/deactivate',
  authenticate,
  deactivateAccount
);

router.post(
  '/reactivate',
  reactivateAccount
);

export default router;