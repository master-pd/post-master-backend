import express from 'express';
import {
  getFeed,
  getCategoryFeed,
  getTagFeed,
  getRecommendedVideos,
  getFollowingActivity
} from '../controllers/feed.controller';
import {
  paginationValidation,
  validateRequest
} from '../middlewares/validation.middleware';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import { generalLimiter } from '../middlewares/rateLimit.middleware';

const router = express.Router();

// Public routes
router.get(
  '/category/:category',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getCategoryFeed
);

router.get(
  '/tag/:tag',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getTagFeed
);

// Protected routes
router.get(
  '/',
  authenticate,
  paginationValidation,
  validateRequest,
  generalLimiter,
  getFeed
);

router.get(
  '/recommended',
  authenticate,
  paginationValidation,
  validateRequest,
  generalLimiter,
  getRecommendedVideos
);

router.get(
  '/following-activity',
  authenticate,
  paginationValidation,
  validateRequest,
  generalLimiter,
  getFollowingActivity
);

export default router;