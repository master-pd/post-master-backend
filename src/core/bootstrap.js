import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';

import container from './container.js';
import eventBus from './eventBus.js';
import router from './router.js';
import gateway from './gateway.js';
import pluginLoader from './pluginLoader.js';
import { createLogger } from '../shared/logger.js';

const logger = createLogger('bootstrap');

export async function bootstrap() {
  logger.info('🚀 Bootstrapping Post-Master Pro Backend...');
  
  const app = express();
  
  // ==================== SECURITY ====================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  
  // CORS
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  }));
  
  // Rate limiting
  app.use('/api/', rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP'
  }));
  
  // Data sanitization
  app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());
  
  // ==================== MIDDLEWARE ====================
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.http(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
  
  // ==================== CORE INITIALIZATION ====================
  try {
    // Initialize container
    await container.initialize();
    logger.info('✅ Container initialized');
    
    // Initialize event bus
    eventBus.initialize();
    logger.info('✅ Event bus initialized');
    
    // Setup core context
    const core = {
      app,
      container,
      eventBus,
      router,
      gateway,
      logger
    };
    
    // Load plugins
    await pluginLoader.loadFeatures(core);
    logger.info('✅ Plugins loaded');
    
    // Setup SDK gateway
    await gateway.setup(core);
    logger.info('✅ SDK gateway ready');
    
    // ==================== ROUTES ====================
    app.use(`/api/${process.env.API_VERSION || 'v1'}`, router.getRouter());
    
    // SDK endpoint
    app.get('/sdk', (req, res) => {
      res.json({
        endpoints: router.getRoutesForSDK(),
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });
    
    // ==================== ERROR HANDLERS ====================
    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`
      });
    });
    
    // Error handler
    app.use((err, req, res, next) => {
      logger.error('Server error:', err);
      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'Something went wrong' 
          : err.message
      });
    });
    
    logger.info('✅ Bootstrap complete');
    return app;
    
  } catch (error) {
    logger.error('❌ Bootstrap failed:', error);
    throw error;
  }
}