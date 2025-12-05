import Redis from 'ioredis';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: Redis;

export const connectRedis = async (): Promise<void> => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 100, 3000);
        }
      });
    } else {
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3
      });
    }

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection closed');
    });

    // Test connection
    await redisClient.ping();
    
  } catch (error) {
    logger.error('Redis connection failed:', error);
    process.exit(1);
  }
};

// Cache functions
export const setCache = async (key: string, value: any, ttl: number = 3600): Promise<void> => {
  try {
    const stringValue = JSON.stringify(value);
    await redisClient.setex(key, ttl, stringValue);
  } catch (error) {
    logger.error('Redis set error:', error);
  }
};

export const getCache = async (key: string): Promise<any> => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
};

export const clearPattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    logger.error('Redis clear pattern error:', error);
  }
};

export const getRedisClient = (): Redis => {
  return redisClient;
};