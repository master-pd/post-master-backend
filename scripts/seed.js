import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../src/shared/logger.js';

const logger = createLogger('seed');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting database seeding...');
    
    // Clear existing data (optional)
    if (process.env.RESET_DB === 'true') {
      await client.query('TRUNCATE TABLE users, posts, comments, likes CASCADE');
      logger.info('✅ Cleared existing data');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Create admin user
    const adminId = uuidv4();
    await client.query(
      `INSERT INTO users (id, email, password, name, role, is_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      [adminId, 'admin@postmaster.com', hashedPassword, 'Admin User', 'admin', true, true]
    );
    logger.info('✅ Created admin user');
    
    // Create test users
    const testUsers = [];
    for (let i = 1; i <= 5; i++) {
      const userId = uuidv4();
      const userPassword = await bcrypt.hash(`user${i}123`, 12);
      
      testUsers.push({
        id: userId,
        email: `user${i}@example.com`,
        password: userPassword,
        name: `Test User ${i}`
      });
      
      await client.query(
        `INSERT INTO users (id, email, password, name, is_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [userId, `user${i}@example.com`, userPassword, `Test User ${i}`, true, true]
      );
    }
    logger.info(`✅ Created ${testUsers.length} test users`);
    
    // Create sample posts
    const samplePosts = [
      {
        title: 'Getting Started with Post-Master',
        content: 'This is a comprehensive guide to get started with Post-Master Pro...',
        category: 'tutorial'
      },
      {
        title: 'Advanced Features Explained',
        content: 'Learn about all the advanced features available in Post-Master Pro...',
        category: 'guide'
      },
      {
        title: 'Best Practices for Content Management',
        content: 'Discover the best practices for managing your content effectively...',
        category: 'tips'
      },
      {
        title: 'API Integration Guide',
        content: 'Learn how to integrate Post-Master API with your applications...',
        category: 'api'
      },
      {
        title: 'Performance Optimization Tips',
        content: 'Optimize your Post-Master instance for maximum performance...',
        category: 'performance'
      }
    ];
    
    for (const [index, post] of samplePosts.entries()) {
      const postId = uuidv4();
      const userId = index === 0 ? adminId : testUsers[index % testUsers.length].id;
      const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      await client.query(
        `INSERT INTO posts (id, user_id, title, slug, content, category, tags, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          postId,
          userId,
          post.title,
          slug,
          post.content,
          post.category,
          JSON.stringify(['post-master', 'tutorial', 'guide']),
          true
        ]
      );
      
      // Create comments for each post
      for (let j = 1; j <= 3; j++) {
        const commentId = uuidv4();
        const commenterId = testUsers[j % testUsers.length].id;
        
        await client.query(
          `INSERT INTO comments (id, post_id, user_id, content)
           VALUES ($1, $2, $3, $4)`,
          [
            commentId,
            postId,
            commenterId,
            `This is comment ${j} on "${post.title}". Great post!`
          ]
        );
      }
      
      // Create likes for posts
      for (const user of testUsers.slice(0, 3)) {
        await client.query(
          `INSERT INTO likes (post_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (post_id, user_id) DO NOTHING`,
          [postId, user.id]
        );
      }
    }
    
    logger.info(`✅ Created ${samplePosts.length} sample posts with comments and likes`);
    
    // Create sample chat messages
    for (let i = 0; i < 3; i++) {
      const messageId = uuidv4();
      const senderId = testUsers[i].id;
      const receiverId = testUsers[(i + 1) % testUsers.length].id;
      
      await client.query(
        `INSERT INTO chat_messages (id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)`,
        [
          messageId,
          senderId,
          receiverId,
          `Hello from User ${i + 1}! How are you doing?`
        ]
      );
    }
    
    logger.info('✅ Created sample chat messages');
    
    await client.query('COMMIT');
    logger.info('✅ Database seeding completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch(error => {
  logger.error('Seed script failed:', error);
  process.exit(1);
});