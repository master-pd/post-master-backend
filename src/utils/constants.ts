// Application constants
export const APP_CONSTANTS = {
  // Application
  APP_NAME: 'Post-Master',
  APP_VERSION: '1.0.0',
  API_VERSION: 'v1',
  
  // Environment
  ENVIRONMENTS: {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TEST: 'test',
  },
  
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  },
  
  // Error Messages
  ERROR_MESSAGES: {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid credentials',
    ACCESS_DENIED: 'Access denied',
    TOKEN_EXPIRED: 'Token expired',
    TOKEN_INVALID: 'Invalid token',
    EMAIL_ALREADY_EXISTS: 'Email already registered',
    USERNAME_ALREADY_EXISTS: 'Username already taken',
    
    // Validation
    VALIDATION_ERROR: 'Validation failed',
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email',
    INVALID_PASSWORD: 'Password must be at least 6 characters',
    
    // Resources
    NOT_FOUND: 'Resource not found',
    ALREADY_EXISTS: 'Resource already exists',
    UNAUTHORIZED_ACCESS: 'You are not authorized to access this resource',
    
    // Server
    INTERNAL_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database error occurred',
    EXTERNAL_SERVICE_ERROR: 'External service error',
  },
  
  // Success Messages
  SUCCESS_MESSAGES: {
    // Auth
    REGISTRATION_SUCCESSFUL: 'Registration successful',
    LOGIN_SUCCESSFUL: 'Login successful',
    LOGOUT_SUCCESSFUL: 'Logout successful',
    PASSWORD_RESET_SUCCESSFUL: 'Password reset successfully',
    EMAIL_VERIFIED: 'Email verified successfully',
    
    // CRUD
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    FETCHED: 'Resource fetched successfully',
    
    // User
    PROFILE_UPDATED: 'Profile updated successfully',
    PICTURE_UPLOADED: 'Picture uploaded successfully',
    FOLLOW_SUCCESSFUL: 'Followed successfully',
    UNFOLLOW_SUCCESSFUL: 'Unfollowed successfully',
  },
  
  // Validation
  VALIDATION: {
    USERNAME: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 30,
      PATTERN: /^[a-zA-Z0-9_]+$/,
    },
    PASSWORD: {
      MIN_LENGTH: 6,
      MAX_LENGTH: 100,
    },
    EMAIL: {
      MAX_LENGTH: 100,
    },
    FULL_NAME: {
      MAX_LENGTH: 100,
    },
    BIO: {
      MAX_LENGTH: 500,
    },
    VIDEO_TITLE: {
      MAX_LENGTH: 100,
    },
    VIDEO_DESCRIPTION: {
      MAX_LENGTH: 2000,
    },
    COMMENT: {
      MAX_LENGTH: 2000,
    },
    TAGS: {
      MAX_COUNT: 20,
    },
  },
  
  // File Upload
  FILE_UPLOAD: {
    // Max file sizes in bytes
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
    
    // Allowed MIME types
    ALLOWED_IMAGE_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
    ALLOWED_VIDEO_TYPES: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-flv',
      'video/webm',
      'video/mpeg',
    ],
    
    // Upload directories
    UPLOAD_DIR: 'uploads',
    IMAGES_DIR: 'images',
    VIDEOS_DIR: 'videos',
    THUMBNAILS_DIR: 'thumbnails',
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  
  // Cache
  CACHE: {
    TTL: {
      SHORT: 300, // 5 minutes
      MEDIUM: 1800, // 30 minutes
      LONG: 3600, // 1 hour
      VERY_LONG: 86400, // 24 hours
    },
    PREFIX: {
      VIDEO: 'video:',
      USER: 'user:',
      FEED: 'feed:',
      COMMENTS: 'comments:',
    },
  },
  
  // JWT
  JWT: {
    ALGORITHM: 'HS256',
    DEFAULT_EXPIRY: '7d',
    REFRESH_EXPIRY: '30d',
  },
  
  // Video Processing
  VIDEO_PROCESSING: {
    STATUS: {
      PROCESSING: 'processing',
      READY: 'ready',
      FAILED: 'failed',
    },
    RESOLUTIONS: [
      '240p',
      '360p',
      '480p',
      '720p',
      '1080p',
      '1440p',
      '2160p',
    ],
    DEFAULT_RESOLUTION: '1080p',
    ASPECT_RATIOS: [
      '16:9',
      '9:16',
      '1:1',
      '4:3',
      '3:4',
    ],
    DEFAULT_ASPECT_RATIO: '16:9',
  },
  
  // Categories
  CATEGORIES: [
    'entertainment',
    'education',
    'sports',
    'music',
    'gaming',
    'comedy',
    'lifestyle',
    'news',
    'other',
  ],
  
  // Notification Types
  NOTIFICATION_TYPES: {
    LIKE: 'like',
    COMMENT: 'comment',
    FOLLOW: 'follow',
    MENTION: 'mention',
    SHARE: 'share',
    NEW_VIDEO: 'new_video',
    SYSTEM: 'system',
  },
  
  // User Roles
  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
  },
  
  // Privacy Settings
  PRIVACY: {
    PUBLIC: 'public',
    PRIVATE: 'private',
    FOLLOWERS_ONLY: 'followers_only',
  },
  
  // Rate Limiting
  RATE_LIMITING: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    AUTH_WINDOW_MS: 60 * 60 * 1000, // 1 hour
    AUTH_MAX_REQUESTS: 5,
  },
  
  // Email
  EMAIL: {
    VERIFICATION_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    PASSWORD_RESET_EXPIRY: 60 * 60 * 1000, // 1 hour
  },
} as const;

// Export types
export type Environment = typeof APP_CONSTANTS.ENVIRONMENTS[keyof typeof APP_CONSTANTS.ENVIRONMENTS];
export type HttpStatus = typeof APP_CONSTANTS.HTTP_STATUS[keyof typeof APP_CONSTANTS.HTTP_STATUS];
export type UserRole = typeof APP_CONSTANTS.USER_ROLES[keyof typeof APP_CONSTANTS.USER_ROLES];
export type NotificationType = typeof APP_CONSTANTS.NOTIFICATION_TYPES[keyof typeof APP_CONSTANTS.NOTIFICATION_TYPES];
export type VideoCategory = typeof APP_CONSTANTS.CATEGORIES[number];
export type PrivacySetting = typeof APP_CONSTANTS.PRIVACY[keyof typeof APP_CONSTANTS.PRIVACY];
export type VideoProcessingStatus = typeof APP_CONSTANTS.VIDEO_PROCESSING.STATUS[keyof typeof APP_CONSTANTS.VIDEO_PROCESSING.STATUS];

// Helper functions
export const isValidCategory = (category: string): category is VideoCategory => {
  return APP_CONSTANTS.CATEGORIES.includes(category as VideoCategory);
};

export const isValidNotificationType = (type: string): type is NotificationType => {
  return Object.values(APP_CONSTANTS.NOTIFICATION_TYPES).includes(type as NotificationType);
};

export const isValidUserRole = (role: string): role is UserRole => {
  return Object.values(APP_CONSTANTS.USER_ROLES).includes(role as UserRole);
};

export const getHttpStatusMessage = (status: HttpStatus): string => {
  const messages: Record<HttpStatus, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  
  return messages[status] || 'Unknown Status';
};

// Default values
export const DEFAULT_VALUES = {
  USER: {
    PROFILE_PICTURE: 'https://res.cloudinary.com/dgs0yrtna/image/upload/v1701693841/default-profile.png',
    COVER_PICTURE: 'https://res.cloudinary.com/dgs0yrtna/image/upload/v1701693841/default-cover.jpg',
    BIO: '',
    SETTINGS: {
      PRIVATE_ACCOUNT: false,
      NOTIFICATIONS: {
        EMAIL: true,
        PUSH: true,
      },
    },
  },
  VIDEO: {
    THUMBNAIL: 'https://res.cloudinary.com/dgs0yrtna/image/upload/v1701693841/default-thumbnail.jpg',
    CATEGORY: 'other',
    IS_PUBLIC: true,
    IS_COMMENTS_ENABLED: true,
    IS_DOWNLOADABLE: false,
    TAGS: [],
  },
  PAGINATION: {
    PAGE: 1,
    LIMIT: 20,
  },
} as const;