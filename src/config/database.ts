import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

class PrismaDatabase {
  private static instance: PrismaDatabase;
  public prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  public static getInstance(): PrismaDatabase {
    if (!PrismaDatabase.instance) {
      PrismaDatabase.instance = new PrismaDatabase();
    }
    return PrismaDatabase.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('✅ PostgreSQL connected successfully via Prisma');
    } catch (error) {
      logger.error('PostgreSQL connection failed:', error);
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('PostgreSQL disconnected');
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL:', error);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const prisma = PrismaDatabase.getInstance().prisma;

// Export connection function
export const connectDatabase = async (): Promise<void> => {
  await PrismaDatabase.getInstance().connect();
};

// Export disconnect function
export const disconnectDatabase = async (): Promise<void> => {
  await PrismaDatabase.getInstance().disconnect();
};