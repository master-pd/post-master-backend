import express from 'express';
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshToken,
  getMe,
  logout,
  changePassword
} from '../controllers/auth.controller';
import {
  authValidation,
  validateRequest
} from '../middlewares/validation.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimit.middleware';

const router = express.Router();

// Public routes
router.post(
  '/register',
  authLimiter,
  authValidation.register,
  validateRequest,
  register
);

router.post(
  '/login',
  authLimiter,
  authValidation.login,
  validateRequest,
  login
);

router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/refresh-token', refreshToken);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.put(
  '/change-password',
  authenticate,
  authValidation.changePassword,
  validateRequest,
  changePassword
);

export default router;