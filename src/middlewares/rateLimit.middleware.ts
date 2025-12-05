import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

// Get Redis client
const redisClient = getRedisClient();

// Create rate limiters
export const generalLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl_general:'
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

export const authLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl_auth:'
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

export const videoUploadLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl_video:'
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 video uploads per hour
  message: {
    success: false,
    message: 'Too many video uploads from this IP, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

export const commentLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl_comment:'
  }) : undefined,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 comments per minute
  message: {
    success: false,
    message: 'Too many comments from this IP, please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Dynamic rate limiter based on user role
export const dynamicLimiter = (req: any, res: Response) => {
  const userRole = req.user?.role || 'anonymous';
  
  const limits: Record<string, number> = {
    admin: 1000,
    moderator: 500,
    user: 100,
    anonymous: 50
  };

  return rateLimit({
    store: redisClient ? new RedisStore({
      // @ts-ignore
      client: redisClient,
      prefix: `rl_dynamic_${userRole}:`
    }) : undefined,
    windowMs: 15 * 60 * 1000,
    max: limits[userRole],
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
      success: false,
      message: `Rate limit exceeded for ${userRole} role. Please try again later.`
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Whitelist certain IPs or users
export const whitelist = [
  '127.0.0.1',
  '::1',
  // Add your trusted IPs here
];

export const skipRateLimit = (req: any) => {
  // Skip rate limiting for whitelisted IPs
  if (whitelist.includes(req.ip)) {
    return true;
  }
  
  // Skip rate limiting for admins
  if (req.user?.role === 'admin') {
    return true;
  }
  
  return false;
};

// Custom rate limit middleware
export const customRateLimit = (windowMs: number, max: number, keyPrefix: string) => {
  return rateLimit({
    store: redisClient ? new RedisStore({
      // @ts-ignore
      client: redisClient,
      prefix: `rl_custom_${keyPrefix}:`
    }) : undefined,
    windowMs,
    max,
    skip: skipRateLimit,
    message: {
      success: false,
      message: `Rate limit exceeded. Please try again after ${Math.ceil(windowMs / 60000)} minutes.`
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Rate limit headers middleware
export const rateLimitHeaders = (req: any, res: Response, next: any) => {
  res.setHeader('X-RateLimit-Info', 'Rate limiting is enabled');
  next();
};