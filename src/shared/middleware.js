import jwt from 'jsonwebtoken';
import { createLogger } from './logger.js';

const logger = createLogger('middleware');

// Authentication middleware
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired' 
      });
    }
    
    res.status(401).json({ 
      error: 'Authentication failed' 
    });
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    // Check if user has required role
    // This depends on your user role system
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

// Validation middleware
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.validatedData = value;
    next();
  };
};

// File upload validation
export const validateFile = (options = {}) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      if (options.required) {
        return res.status(400).json({ 
          error: 'File is required' 
        });
      }
      return next();
    }
    
    const file = req.file || (req.files ? req.files[0] : null);
    
    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      return res.status(400).json({ 
        error: `File size exceeds ${options.maxSize / 1024 / 1024}MB limit` 
      });
    }
    
    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: `File type ${file.mimetype} not allowed` 
      });
    }
    
    next();
  };
};

// Rate limiting per user
export const userRateLimit = (windowMs, maxRequests) => {
  const requests = new Map();
  
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.timestamp > windowMs) {
        requests.delete(key);
      }
    }
  }, windowMs);
  
  return (req, res, next) => {
    const userId = req.user?.userId || req.ip;
    const key = `rate-limit:${userId}`;
    
    const userRequests = requests.get(key) || { count: 0, timestamp: Date.now() };
    
    if (userRequests.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((userRequests.timestamp + windowMs - Date.now()) / 1000)
      });
    }
    
    userRequests.count++;
    requests.set(key, userRequests);
    
    // Add headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - userRequests.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((userRequests.timestamp + windowMs) / 1000));
    
    next();
  };
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.userId || 'anonymous'
    });
  });
  
  next();
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.userId
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.message
    });
  }
  
  // Default error response
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(status).json({
    error: 'Server Error',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

// CORS middleware
export const corsMiddleware = (req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};