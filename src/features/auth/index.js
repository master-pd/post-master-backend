import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export async function register(core) {
  const { container, eventBus, router, logger } = core;
  
  const featureLogger = logger.child({ module: 'auth' });
  featureLogger.info('Initializing auth feature...');
  
  // ==================== ROUTES ====================
  router.register('auth', [
    // Register
    {
      method: 'POST',
      path: '/auth/register',
      secured: false,
      handler: async (req, res) => {
        try {
          const { email, password, name } = req.body;
          
          if (!email || !password || !name) {
            return res.status(400).json({ 
              error: 'Email, password, and name are required' 
            });
          }
          
          const db = container.get('db');
          
          // Check existing user
          const existing = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
          );
          
          if (existing.rows.length > 0) {
            return res.status(409).json({ 
              error: 'User already exists' 
            });
          }
          
          // Hash password
          const hashedPassword = await bcrypt.hash(password, 12);
          const userId = uuidv4();
          
          // Create user
          await db.query(
            `INSERT INTO users (id, email, password, name, created_at) 
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, email, hashedPassword, name]
          );
          
          // Generate token
          const token = jwt.sign(
            { userId, email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
          );
          
          // Emit event
          await eventBus.emit('user.registered', { userId, email, name });
          
          res.status(201).json({
            success: true,
            data: {
              userId,
              email,
              name,
              token
            }
          });
          
        } catch (error) {
          featureLogger.error('Registration error:', error);
          res.status(500).json({ 
            error: 'Registration failed' 
          });
        }
      }
    },
    
    // Login
    {
      method: 'POST',
      path: '/auth/login',
      secured: false,
      handler: async (req, res) => {
        try {
          const { email, password } = req.body;
          
          if (!email || !password) {
            return res.status(400).json({ 
              error: 'Email and password required' 
            });
          }
          
          const db = container.get('db');
          
          // Get user
          const result = await db.query(
            'SELECT id, email, password, name FROM users WHERE email = $1',
            [email]
          );
          
          if (result.rows.length === 0) {
            return res.status(401).json({ 
              error: 'Invalid credentials' 
            });
          }
          
          const user = result.rows[0];
          
          // Verify password
          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            return res.status(401).json({ 
              error: 'Invalid credentials' 
            });
          }
          
          // Generate token
          const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
          );
          
          // Update last login
          await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
          );
          
          // Emit event
          await eventBus.emit('user.logged_in', { 
            userId: user.id, 
            email: user.email 
          });
          
          res.json({
            success: true,
            data: {
              userId: user.id,
              email: user.email,
              name: user.name,
              token
            }
          });
          
        } catch (error) {
          featureLogger.error('Login error:', error);
          res.status(500).json({ 
            error: 'Login failed' 
          });
        }
      }
    },
    
    // Profile
    {
      method: 'GET',
      path: '/auth/profile',
      secured: true,
      handler: async (req, res) => {
        try {
          const userId = req.user.userId;
          const db = container.get('db');
          
          const result = await db.query(
            'SELECT id, email, name, created_at FROM users WHERE id = $1',
            [userId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ 
              error: 'User not found' 
            });
          }
          
          res.json({
            success: true,
            data: result.rows[0]
          });
          
        } catch (error) {
          featureLogger.error('Profile error:', error);
          res.status(500).json({ 
            error: 'Failed to fetch profile' 
          });
        }
      }
    },
    
    // Logout
    {
      method: 'POST',
      path: '/auth/logout',
      secured: true,
      handler: async (req, res) => {
        try {
          const userId = req.user.userId;
          
          // Emit event
          await eventBus.emit('user.logged_out', { userId });
          
          res.json({
            success: true,
            message: 'Logged out successfully'
          });
          
        } catch (error) {
          featureLogger.error('Logout error:', error);
          res.status(500).json({ 
            error: 'Logout failed' 
          });
        }
      }
    }
  ]);
  
  // ==================== EVENT LISTENERS ====================
  eventBus.on('user.registered', async (data) => {
    featureLogger.info(`New user registered: ${data.email}`);
    
    // Send welcome email
    try {
      // Email logic here
      featureLogger.debug(`Welcome email sent to: ${data.email}`);
    } catch (error) {
      featureLogger.error('Failed to send welcome email:', error);
    }
  });
  
  eventBus.on('user.logged_in', (data) => {
    featureLogger.info(`User logged in: ${data.email}`);
  });
  
  featureLogger.info('✅ Auth feature initialized');
  
  return {
    name: 'auth',
    version: '1.0.0',
    cleanup: () => {
      featureLogger.info('Cleaning up auth feature');
    }
  };
}