import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { sendEmail, emailTemplates } from '../config/email';
import { asyncHandler } from '../middlewares/error.middleware';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';
import bcrypt from 'bcryptjs';

// Generate JWT Token
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Generate Refresh Token
const generateRefreshToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, fullName } = req.body;

  // Check if user exists
  const existingUser = await Promise.all([
    UserRepository.findByEmail(email),
    UserRepository.findByUsername(username)
  ]);

  if (existingUser[0]) {
    res.status(400);
    throw new Error('Email already registered');
  }

  if (existingUser[1]) {
    res.status(400);
    throw new Error('Username already taken');
  }

  // Create verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create user
  const user = await UserRepository.create({
    username,
    email,
    password,
    fullName,
    verificationToken,
    verificationTokenExpires
  });

  // Generate token
  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Send verification email
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const emailSent = await sendEmail(
    email,
    emailTemplates.welcome(fullName || username, verificationLink).subject,
    emailTemplates.welcome(fullName || username, verificationLink).html
  );

  if (!emailSent) {
    logger.warn(`Verification email failed to send to ${email}`);
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please check your email for verification.',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified
      },
      token,
      refreshToken
    }
  });
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  if (!password) {
    res.status(400);
    throw new Error('Password is required');
  }

  // Find user by email or username
  let user;
  if (email) {
    user = await UserRepository.findByEmail(email.toLowerCase());
  } else if (username) {
    user = await UserRepository.findByUsername(username.toLowerCase());
  } else {
    res.status(400);
    throw new Error('Email or username is required');
  }

  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('Account is deactivated');
  }

  // Check password
  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Update last login
  await UserRepository.updateLastLogin(user.id);

  // Generate tokens
  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Remove password from response
  const { password: _, ...userResponse } = user;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: userResponse,
      token,
      refreshToken
    }
  });
});

// @desc    Verify email
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  // Verify email using repository
  const user = await UserRepository.verifyEmail(token);

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired verification token');
  }

  // Generate new token
  const authToken = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified
      },
      token: authToken,
      refreshToken
    }
  });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await UserRepository.findByEmail(email);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  // Save reset token
  await UserRepository.setPasswordResetToken(email, resetToken, resetTokenExpires);

  // Send reset email
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const emailSent = await sendEmail(
    email,
    emailTemplates.passwordReset(user.fullName || user.username, resetLink).subject,
    emailTemplates.passwordReset(user.fullName || user.username, resetLink).html
  );

  if (!emailSent) {
    logger.warn(`Password reset email failed to send to ${email}`);
  }

  res.status(200).json({
    success: true,
    message: 'Password reset email sent successfully'
  });
});

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password/:token
// @access  Public
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  // Find user by reset token
  const user = await UserRepository.findByPasswordResetToken(token);

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  // Update password
  await UserRepository.updatePassword(user.id, password);

  // Generate new tokens
  const authToken = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    data: {
      token: authToken,
      refreshToken
    }
  });
});

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await UserRepository.findById(req.user.id, true);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Remove password from response
  const { password: _, ...userResponse } = user;

  res.status(200).json({
    success: true,
    data: { user: userResponse }
  });
});

// @desc    Change password
// @route   PUT /api/v1/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  // Check current password
  const isPasswordMatch = await UserRepository.comparePassword(req.user.id, currentPassword);
  if (!isPasswordMatch) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  // Update password
  await UserRepository.updatePassword(req.user.id, newPassword);

  // Generate new tokens
  const token = generateToken(req.user.id);
  const refreshToken = generateRefreshToken(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: {
      token,
      refreshToken
    }
  });
});