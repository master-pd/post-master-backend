// server.ts - Termux-ready
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';
import { initSocket } from './sockets';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to PostgreSQL database
    await connectDatabase();

    // Connect to Redis
    await connectRedis();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 PostgreSQL connected successfully`);
    });

    // Initialize Socket.IO
    initSocket(server);

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('🛑 Shutting down gracefully...');

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        logger.info('💤 Server shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('Forcefully shutting down...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
