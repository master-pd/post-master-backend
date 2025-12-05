import { Request, Response, NextFunction } from 'express';
import { validationResult, body, param, query } from 'express-validator';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Express-validator middleware
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : err.type,
        message: err.msg
      }))
    });
    return;
  }
  
  next();
};

// Zod validation middleware
export const validateZod = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        logger.error('Zod validation error:', error);
        res.status(500).json({
          success: false,
          message: 'Validation error'
        });
      }
    }
  };
};

// Common validation chains
export const authValidation = {
  register: [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters')
  ],
  
  login: [
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Please enter a valid email')
      .normalizeEmail(),
    
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    
    body('password')
      .notEmpty().withMessage('Password is required')
  ],
  
  resetPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email')
      .normalizeEmail()
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
      .not().equals(body('currentPassword')).withMessage('New password must be different from current password'),
    
    body('confirmPassword')
      .notEmpty().withMessage('Confirm password is required')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match')
  ]
};

export const userValidation = {
  updateProfile: [
    body('fullName')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters'),
    
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
    
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores')
  ]
};

export const videoValidation = {
  uploadVideo: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags: string[]) => tags.length <= 20).withMessage('Maximum 20 tags allowed'),
    
    body('category')
      .optional()
      .isIn([
        'entertainment', 'education', 'sports', 'music', 
        'gaming', 'comedy', 'lifestyle', 'news', 'other'
      ]).withMessage('Invalid category'),
    
    body('isPublic')
      .optional()
      .isBoolean().withMessage('isPublic must be a boolean'),
    
    body('isCommentsEnabled')
      .optional()
      .isBoolean().withMessage('isCommentsEnabled must be a boolean'),
    
    body('isDownloadable')
      .optional()
      .isBoolean().withMessage('isDownloadable must be a boolean')
  ],
  
  updateVideo: [
    param('id')
      .notEmpty().withMessage('Video ID is required')
      .isMongoId().withMessage('Invalid video ID'),
    
    body('title')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
    
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags: string[]) => tags.length <= 20).withMessage('Maximum 20 tags allowed'),
    
    body('category')
      .optional()
      .isIn([
        'entertainment', 'education', 'sports', 'music', 
        'gaming', 'comedy', 'lifestyle', 'news', 'other'
      ]).withMessage('Invalid category'),
    
    body('isPublic')
      .optional()
      .isBoolean().withMessage('isPublic must be a boolean'),
    
    body('isCommentsEnabled')
      .optional()
      .isBoolean().withMessage('isCommentsEnabled must be a boolean'),
    
    body('isDownloadable')
      .optional()
      .isBoolean().withMessage('isDownloadable must be a boolean')
  ]
};

export const commentValidation = {
  createComment: [
    body('content')
      .trim()
      .notEmpty().withMessage('Comment content is required')
      .isLength({ max: 2000 }).withMessage('Comment cannot exceed 2000 characters'),
    
    body('videoId')
      .notEmpty().withMessage('Video ID is required')
      .isMongoId().withMessage('Invalid video ID'),
    
    body('parentCommentId')
      .optional()
      .isMongoId().withMessage('Invalid parent comment ID')
  ],
  
  updateComment: [
    param('id')
      .notEmpty().withMessage('Comment ID is required')
      .isMongoId().withMessage('Invalid comment ID'),
    
    body('content')
      .trim()
      .notEmpty().withMessage('Comment content is required')
      .isLength({ max: 2000 }).withMessage('Comment cannot exceed 2000 characters')
  ]
};

// Pagination validation
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];