import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure log directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.align(),
  winston.format.printf(info => {
    const { timestamp, level, message, ...args } = info;
    const ts = timestamp.slice(0, 19).replace('T', ' ');
    return `${ts} [${level}]: ${message} ${
      Object.keys(args).length ? JSON.stringify(args, null, 2) : ''
    }`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'post-master-backend' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write HTTP requests to access.log
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Create a stream for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Log levels
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
} as const;

// Custom logging methods
export const log = {
  // Error logging
  error: (message: string, error?: any) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else {
      logger.error(message, error);
    }
  },

  // Warning logging
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },

  // Info logging
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },

  // Debug logging
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },

  // HTTP request logging
  http: (message: string, meta?: any) => {
    logger.http(message, meta);
  },

  // Database query logging
  db: (query: string, duration: number, meta?: any) => {
    logger.debug(`Database query executed in ${duration}ms`, {
      query,
      duration,
      ...meta,
    });
  },

  // API request logging
  api: (req: any, res: any, responseTime: number) => {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?._id,
    };

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl}`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl}`, meta);
    } else {
      logger.http(`${req.method} ${req.originalUrl}`, meta);
    }
  },

  // Security logging
  security: (event: string, meta?: any) => {
    logger.warn(`Security event: ${event}`, meta);
  },

  // Performance logging
  performance: (operation: string, duration: number, meta?: any) => {
    logger.debug(`${operation} took ${duration}ms`, {
      operation,
      duration,
      ...meta,
    });
  },
};

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    log.api(req, res, duration);
  });

  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req?: any) => {
  log.error(error.message, {
    error,
    request: req
      ? {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userId: req.user?._id,
        }
      : undefined,
  });
};

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception', error);
  process.exit(1);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Promise Rejection', { reason, promise });
});