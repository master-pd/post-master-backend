import { Pool } from 'pg';
import Redis from 'ioredis';
import { createLogger } from '../shared/logger.js';

const logger = createLogger('container');

class Container {
  constructor() {
    this.services = new Map();
    this.db = null;
    this.redis = null;
    this.cache = null;
  }

  async initialize() {
    try {
      // Database
      this.db = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      // Test DB connection
      const client = await this.db.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('✅ PostgreSQL connected');
      
      // Redis
      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
      
      this.redis.on('connect', () => logger.info('✅ Redis connected'));
      this.redis.on('error', (err) => logger.error('Redis error:', err));
      
      // Cache service
      this.cache = {
        get: async (key) => {
          const data = await this.redis.get(key);
          return data ? JSON.parse(data) : null;
        },
        set: async (key, value, ttl = 3600) => {
          await this.redis.setex(key, ttl, JSON.stringify(value));
        },
        del: async (key) => {
          await this.redis.del(key);
        }
      };
      
      // Register core services
      this.register('db', this.db);
      this.register('redis', this.redis);
      this.register('cache', this.cache);
      this.register('logger', logger);
      
      logger.info('✅ Container services registered');
      
    } catch (error) {
      logger.error('❌ Container initialization failed:', error);
      throw error;
    }
  }

  register(name, service) {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} already registered`);
    }
    this.services.set(name, service);
    logger.debug(`Service registered: ${name}`);
  }

  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }

  async shutdown() {
    logger.info('Shutting down container...');
    
    if (this.db) await this.db.end();
    if (this.redis) await this.redis.quit();
    
    logger.info('✅ Container shutdown complete');
  }
}

export default new Container();