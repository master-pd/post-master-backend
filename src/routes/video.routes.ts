import express from 'express';
import {
  uploadVideo,
  getVideo,
  updateVideo,
  deleteVideo,
  toggleLike,
  toggleSave,
  getVideoComments,
  getTrendingVideos,
  getLatestVideos,
  searchVideos
} from '../controllers/video.controller';
import {
  videoValidation,
  paginationValidation,
  validateRequest
} from '../middlewares/validation.middleware';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import { uploadVideoMiddleware, checkFileType } from '../middlewares/upload.middleware';
import { generalLimiter, videoUploadLimiter } from '../middlewares/rateLimit.middleware';

const router = express.Router();

// Public routes
router.get(
  '/:id',
  optionalAuthenticate,
  generalLimiter,
  getVideo
);

router.get(
  '/:id/comments',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getVideoComments
);

router.get(
  '/trending',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getTrendingVideos
);

router.get(
  '/latest',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getLatestVideos
);

router.get(
  '/search',
  paginationValidation,
  validateRequest,
  generalLimiter,
  searchVideos
);

// Protected routes
router.post(
  '/upload',
  authenticate,
  videoUploadLimiter,
  uploadVideoMiddleware,
  checkFileType,
  videoValidation.uploadVideo,
  validateRequest,
  uploadVideo
);

router.put(
  '/:id',
  authenticate,
  videoValidation.updateVideo,
  validateRequest,
  updateVideo
);

router.delete(
  '/:id',
  authenticate,
  deleteVideo
);

router.post(
  '/:id/like',
  authenticate,
  generalLimiter,
  toggleLike
);

router.post(
  '/:id/save',
  authenticate,
  generalLimiter,
  toggleSave
);

export default router;