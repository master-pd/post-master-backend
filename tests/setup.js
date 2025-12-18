import { Pool } from 'pg';
import Redis from 'ioredis';

// Global test setup
beforeAll(async () => {
  // Setup test database
  if (process.env.NODE_ENV === 'test') {
    const testPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    });
    
    // Clean test database
    const client = await testPool.connect();
    try {
      await client.query('DROP SCHEMA public CASCADE');
      await client.query('CREATE SCHEMA public');
      await client.query('GRANT ALL ON SCHEMA public TO postgres');
      await client.query('GRANT ALL ON SCHEMA public TO public');
    } finally {
      client.release();
      await testPool.end();
    }
  }
});

// Global teardown
afterAll(async () => {
  // Cleanup resources
  if (global.testRedis) {
    await global.testRedis.quit();
  }
});

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock console for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};