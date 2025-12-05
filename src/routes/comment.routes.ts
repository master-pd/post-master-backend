import express from 'express';
import {
  createComment,
  updateComment,
  deleteComment,
  toggleLikeComment,
  getCommentReplies,
  togglePinComment,
  reportComment
} from '../controllers/comment.controller';
import {
  commentValidation,
  paginationValidation,
  validateRequest
} from '../middlewares/validation.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { generalLimiter, commentLimiter } from '../middlewares/rateLimit.middleware';

const router = express.Router();

// Public routes
router.get(
  '/:id/replies',
  paginationValidation,
  validateRequest,
  generalLimiter,
  getCommentReplies
);

// Protected routes
router.post(
  '/',
  authenticate,
  commentLimiter,
  commentValidation.createComment,
  validateRequest,
  createComment
);

router.put(
  '/:id',
  authenticate,
  commentValidation.updateComment,
  validateRequest,
  updateComment
);

router.delete(
  '/:id',
  authenticate,
  deleteComment
);

router.post(
  '/:id/like',
  authenticate,
  generalLimiter,
  toggleLikeComment
);

router.post(
  '/:id/pin',
  authenticate,
  generalLimiter,
  togglePinComment
);

router.post(
  '/:id/report',
  authenticate,
  generalLimiter,
  reportComment
);

export default router;