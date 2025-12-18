import request from 'supertest';
import { createApp } from '../../src/server.js';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

describe('Auth Endpoints', () => {
  let app;
  let pool;
  let testUserId;

  beforeAll(async () => {
    app = await createApp();
    
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    });
    
    // Clean up before tests
    await pool.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Test@12345',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.email).toBe(userData.email);
      
      testUserId = response.body.data.userId;
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Test@12345',
        name: 'Another User'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'Test@12345'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.email).toBe(credentials.email);
    });

    it('should reject invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test@12345'
        });
      
      authToken = loginResponse.body.data.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.name).toBe('Test User');
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);
    });
  });
});