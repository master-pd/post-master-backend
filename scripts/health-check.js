import { Pool } from 'pg';
import Redis from 'ioredis';
import { createLogger } from '../src/shared/logger.js';

const logger = createLogger('health-check');

async function checkHealth() {
  const checks = {
    database: false,
    redis: false,
    memory: false,
    disk: false,
    timestamp: new Date().toISOString()
  };
  
  let exitCode = 0;
  
  // Check database
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000
    });
    
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    
    checks.database = true;
    logger.info('✅ Database connection successful');
  } catch (error) {
    checks.database = false;
    logger.error('❌ Database connection failed:', error.message);
    exitCode = 1;
  }
  
  // Check Redis
  try {
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000
    });
    
    await redis.ping();
    await redis.quit();
    
    checks.redis = true;
    logger.info('✅ Redis connection successful');
  } catch (error) {
    checks.redis = false;
    logger.error('❌ Redis connection failed:', error.message);
    exitCode = 1;
  }
  
  // Check memory usage
  const memoryUsage = process.memoryUsage();
  checks.memory = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
  };
  
  // Check disk space (if on Linux)
  if (process.platform === 'linux') {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.statfs('/');
      const free = stats.bavail * stats.bsize;
      const total = stats.blocks * stats.bsize;
      const used = total - free;
      
      checks.disk = {
        total: Math.round(total / 1024 / 1024) + 'MB',
        used: Math.round(used / 1024 / 1024) + 'MB',
        free: Math.round(free / 1024 / 1024) + 'MB',
        usagePercent: Math.round((used / total) * 100) + '%'
      };
    } catch (error) {
      checks.disk = 'Unable to check disk space';
    }
  }
  
  // Overall status
  const isHealthy = checks.database && checks.redis;
  checks.status = isHealthy ? 'healthy' : 'unhealthy';
  checks.uptime = process.uptime();
  
  // Log results
  console.log(JSON.stringify(checks, null, 2));
  
  // Exit with appropriate code
  process.exit(exitCode);
}

checkHealth().catch(error => {
  logger.error('Health check failed:', error);
  process.exit(1);
});