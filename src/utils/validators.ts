import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
    email: z.string()
      .email('Please enter a valid email')
      .min(1, 'Email is required'),
    password: z.string()
      .min(6, 'Password must be at least 6 characters')
      .max(100, 'Password cannot exceed 100 characters'),
    fullName: z.string()
      .min(1, 'Full name is required')
      .max(100, 'Full name cannot exceed 100 characters')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string()
      .email('Please enter a valid email')
      .optional(),
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .optional(),
    password: z.string()
      .min(1, 'Password is required')
  }).refine(data => data.email || data.username, {
    message: 'Either email or username is required'
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string()
      .min(1, 'Current password is required'),
    newPassword: z.string()
      .min(6, 'New password must be at least 6 characters')
      .max(100, 'New password cannot exceed 100 characters'),
    confirmPassword: z.string()
      .min(1, 'Confirm password is required')
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  }).refine(data => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword']
  })
});

// User schemas
export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string()
      .max(100, 'Full name cannot exceed 100 characters')
      .optional(),
    bio: z.string()
      .max(500, 'Bio cannot exceed 500 characters')
      .optional(),
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores')
      .optional(),
    settings: z.object({
      privateAccount: z.boolean().optional(),
      notifications: z.object({
        email: z.boolean().optional(),
        push: z.boolean().optional()
      }).optional()
    }).optional()
  })
});

// Video schemas
export const uploadVideoSchema = z.object({
  body: z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(100, 'Title cannot exceed 100 characters'),
    description: z.string()
      .max(2000, 'Description cannot exceed 2000 characters')
      .optional()
      .default(''),
    tags: z.union([
      z.string(),
      z.array(z.string())
    ])
      .transform(val => {
        if (typeof val === 'string') {
          return val.split(',').map(tag => tag.trim().toLowerCase()).slice(0, 20);
        }
        return val.map(tag => tag.trim().toLowerCase()).slice(0, 20);
      })
      .optional()
      .default([]),
    category: z.enum([
      'entertainment', 'education', 'sports', 'music', 
      'gaming', 'comedy', 'lifestyle', 'news', 'other'
    ])
      .optional()
      .default('other'),
    isPublic: z.boolean()
      .optional()
      .default(true),
    isCommentsEnabled: z.boolean()
      .optional()
      .default(true),
    isDownloadable: z.boolean()
      .optional()
      .default(false)
  })
});

export const updateVideoSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, 'Video ID is required')
  }),
  body: z.object({
    title: z.string()
      .max(100, 'Title cannot exceed 100 characters')
      .optional(),
    description: z.string()
      .max(2000, 'Description cannot exceed 2000 characters')
      .optional(),
    tags: z.union([
      z.string(),
      z.array(z.string())
    ])
      .transform(val => {
        if (typeof val === 'string') {
          return val.split(',').map(tag => tag.trim().toLowerCase()).slice(0, 20);
        }
        return val.map(tag => tag.trim().toLowerCase()).slice(0, 20);
      })
      .optional(),
    category: z.enum([
      'entertainment', 'education', 'sports', 'music', 
      'gaming', 'comedy', 'lifestyle', 'news', 'other'
    ])
      .optional(),
    isPublic: z.boolean()
      .optional(),
    isCommentsEnabled: z.boolean()
      .optional(),
    isDownloadable: z.boolean()
      .optional()
  })
});

// Comment schemas
export const createCommentSchema = z.object({
  body: z.object({
    content: z.string()
      .min(1, 'Comment content is required')
      .max(2000, 'Comment cannot exceed 2000 characters'),
    videoId: z.string()
      .min(1, 'Video ID is required'),
    parentCommentId: z.string()
      .optional()
  })
});

export const updateCommentSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, 'Comment ID is required')
  }),
  body: z.object({
    content: z.string()
      .min(1, 'Comment content is required')
      .max(2000, 'Comment cannot exceed 2000 characters')
  })
});

// Pagination schema
export const paginationSchema = z.object({
  query: z.object({
    page: z.string()
      .regex(/^\d+$/, 'Page must be a positive integer')
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0, 'Page must be greater than 0')
      .optional()
      .default('1'),
    limit: z.string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional()
      .default('20')
  })
});

// Search schema
export const searchSchema = z.object({
  query: z.object({
    q: z.string()
      .min(1, 'Search query is required')
      .max(100, 'Search query cannot exceed 100 characters'),
    page: z.string()
      .regex(/^\d+$/, 'Page must be a positive integer')
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0, 'Page must be greater than 0')
      .optional()
      .default('1'),
    limit: z.string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional()
      .default('20')
  })
});

// File upload validation
export const validateFile = (file: Express.Multer.File, allowedTypes: string[], maxSize: number) => {
  const errors: string[] = [];

  if (!allowedTypes.includes(file.mimetype)) {
    errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }

  if (file.size > maxSize) {
    errors.push(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
  }

  return errors;
};

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// URL validation
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};