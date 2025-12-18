import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../shared/logger.js';
import cloudinary from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function register(core) {
  const { container, eventBus, router, logger } = core;
  
  const featureLogger = logger.child({ module: 'post' });
  featureLogger.info('📝 Initializing post feature...');
  
  // ==================== ROUTES ====================
  router.register('post', [
    // Create Post
    {
      method: 'POST',
      path: '/posts',
      secured: true,
      handler: async (req, res) => {
        try {
          const userId = req.user.userId;
          const { title, content, tags, category, isPublished = true } = req.body;
          
          if (!title || !content) {
            return res.status(400).json({ 
              error: 'Title and content are required' 
            });
          }
          
          const db = container.get('db');
          
          // Generate slug
          const slug = generateSlug(title);
          const postId = uuidv4();
          
          // Create post
          await db.query(
            `INSERT INTO posts (
              id, user_id, title, slug, content, 
              tags, category, is_published, published_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              postId,
              userId,
              title,
              slug,
              content,
              JSON.stringify(tags || []),
              category || null,
              isPublished,
              isPublished ? new Date() : null
            ]
          );
          
          // Emit event
          await eventBus.emit('post.created', {
            postId,
            userId,
            title,
            slug
          });
          
          // Clear cache
          await container.get('cache').del('posts:all');
          await container.get('cache').del(`user:${userId}:posts`);
          
          res.status(201).json({
            success: true,
            message: 'Post created successfully',
            data: { postId, slug, title }
          });
          
        } catch (error) {
          featureLogger.error('Create post error:', error);
          res.status(500).json({ 
            error: 'Failed to create post' 
          });
        }
      }
    },
    
    // Get All Posts
    {
      method: 'GET',
      path: '/posts',
      secured: false,
      handler: async (req, res) => {
        try {
          const { 
            page = 1, 
            limit = 10, 
            category, 
            search, 
            userId 
          } = req.query;
          
          const offset = (page - 1) * limit;
          const db = container.get('db');
          const cache = container.get('cache');
          
          // Generate cache key
          const cacheKey = `posts:page:${page}:limit:${limit}:cat:${category}:search:${search}:user:${userId}`;
          
          // Try cache first
          const cached = await cache.get(cacheKey);
          if (cached) {
            return res.json({
              success: true,
              data: cached.posts,
              pagination: cached.pagination,
              source: 'cache'
            });
          }
          
          // Build query
          let query = `
            SELECT 
              p.*,
              u.name as author_name,
              u.avatar_url as author_avatar,
              COUNT(l.id) as like_count,
              COUNT(c.id) as comment_count
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN likes l ON p.id = l.post_id
            LEFT JOIN comments c ON p.id = c.post_id
            WHERE p.is_published = true
          `;
          
          const params = [];
          let paramCount = 0;
          
          if (category) {
            paramCount++;
            query += ` AND p.category = $${paramCount}`;
            params.push(category);
          }
          
          if (search) {
            paramCount++;
            query += ` AND (p.title ILIKE $${paramCount} OR p.content ILIKE $${paramCount})`;
            params.push(`%${search}%`);
          }
          
          if (userId) {
            paramCount++;
            query += ` AND p.user_id = $${paramCount}`;
            params.push(userId);
          }
          
          // Group by
          query += ` GROUP BY p.id, u.id`;
          
          // Count total
          const countQuery = query.replace(
            'SELECT p.*, u.name as author_name, u.avatar_url as author_avatar, COUNT(l.id) as like_count, COUNT(c.id) as comment_count',
            'SELECT COUNT(DISTINCT p.id)'
          );
          
          const countResult = await db.query(countQuery, params);
          const total = parseInt(countResult.rows[0].count);
          
          // Add pagination
          paramCount++;
          query += ` ORDER BY p.created_at DESC LIMIT $${paramCount}`;
          params.push(limit);
          
          paramCount++;
          query += ` OFFSET $${paramCount}`;
          params.push(offset);
          
          // Execute
          const result = await db.query(query, params);
          
          const posts = result.rows.map(post => ({
            ...post,
            tags: post.tags || [],
            metadata: post.metadata || {}
          }));
          
          const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: offset + limit < total,
            hasPrev: page > 1
          };
          
          // Cache for 5 minutes
          await cache.set(cacheKey, { posts, pagination }, 300);
          
          res.json({
            success: true,
            data: posts,
            pagination,
            source: 'database'
          });
          
        } catch (error) {
          featureLogger.error('Get posts error:', error);
          res.status(500).json({ 
            error: 'Failed to fetch posts' 
          });
        }
      }
    },
    
    // Get Single Post
    {
      method: 'GET',
      path: '/posts/:slug',
      secured: false,
      handler: async (req, res) => {
        try {
          const { slug } = req.params;
          const db = container.get('db');
          const cache = container.get('cache');
          
          // Cache key
          const cacheKey = `post:${slug}`;
          
          // Try cache
          const cached = await cache.get(cacheKey);
          if (cached) {
            // Increment view count asynchronously
            db.query(
              'UPDATE posts SET view_count = view_count + 1 WHERE slug = $1',
              [slug]
            ).catch(err => featureLogger.error('View count error:', err));
            
            return res.json({
              success: true,
              data: cached,
              source: 'cache'
            });
          }
          
          // Query database
          const result = await db.query(
            `SELECT 
              p.*,
              u.name as author_name,
              u.avatar_url as author_avatar,
              u.bio as author_bio,
              COUNT(DISTINCT l.id) as like_count,
              COUNT(DISTINCT c.id) as comment_count
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN likes l ON p.id = l.post_id
            LEFT JOIN comments c ON p.id = c.post_id
            WHERE p.slug = $1 AND p.is_published = true
            GROUP BY p.id, u.id`,
            [slug]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ 
              error: 'Post not found' 
            });
          }
          
          const post = result.rows[0];
          
          // Update view count
          await db.query(
            'UPDATE posts SET view_count = view_count + 1 WHERE id = $1',
            [post.id]
          );
          
          // Format response
          const postData = {
            ...post,
            tags: post.tags || [],
            metadata: post.metadata || {}
          };
          
          // Cache for 10 minutes
          await cache.set(cacheKey, postData, 600);
          
          // Get related posts
          const related = await db.query(
            `SELECT id, title, slug, excerpt, featured_image, created_at
             FROM posts 
             WHERE category = $1 AND id != $2 AND is_published = true
             ORDER BY created_at DESC
             LIMIT 3`,
            [post.category, post.id]
          );
          
          res.json({
            success: true,
            data: {
              post: postData,
              related: related.rows
            },
            source: 'database'
          });
          
        } catch (error) {
          featureLogger.error('Get post error:', error);
          res.status(500).json({ 
            error: 'Failed to fetch post' 
          });
        }
      }
    },
    
    // Update Post
    {
      method: 'PUT',
      path: '/posts/:id',
      secured: true,
      handler: async (req, res) => {
        try {
          const postId = req.params.id;
          const userId = req.user.userId;
          const updates = req.body;
          
          const db = container.get('db');
          
          // Check ownership
          const ownership = await db.query(
            'SELECT user_id FROM posts WHERE id = $1',
            [postId]
          );
          
          if (ownership.rows.length === 0) {
            return res.status(404).json({ 
              error: 'Post not found' 
            });
          }
          
          if (ownership.rows[0].user_id !== userId) {
            return res.status(403).json({ 
              error: 'Not authorized to update this post' 
            });
          }
          
          // Build update query
          const updateFields = [];
          const values = [];
          let paramCount = 1;
          
          if (updates.title) {
            updateFields.push(`title = $${paramCount}`);
            values.push(updates.title);
            paramCount++;
            
            // Update slug if title changed
            const newSlug = generateSlug(updates.title);
            updateFields.push(`slug = $${paramCount}`);
            values.push(newSlug);
            paramCount++;
          }
          
          if (updates.content) {
            updateFields.push(`content = $${paramCount}`);
            values.push(updates.content);
            paramCount++;
          }
          
          if (updates.category !== undefined) {
            updateFields.push(`category = $${paramCount}`);
            values.push(updates.category);
            paramCount++;
          }
          
          if (updates.tags !== undefined) {
            updateFields.push(`tags = $${paramCount}`);
            values.push(JSON.stringify(updates.tags));
            paramCount++;
          }
          
          if (updates.isPublished !== undefined) {
            updateFields.push(`is_published = $${paramCount}`);
            values.push(updates.isPublished);
            paramCount++;
            
            if (updates.isPublished) {
              updateFields.push(`published_at = $${paramCount}`);
              values.push(new Date());
              paramCount++;
            }
          }
          
          updateFields.push(`updated_at = $${paramCount}`);
          values.push(new Date());
          paramCount++;
          
          values.push(postId);
          
          // Execute update
          await db.query(
            `UPDATE posts SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
            values
          );
          
          // Clear cache
          const cache = container.get('cache');
          await cache.clearPattern('posts:*');
          await cache.clearPattern(`post:*`);
          await cache.del(`user:${userId}:posts`);
          
          // Emit event
          await eventBus.emit('post.updated', { postId, userId });
          
          res.json({
            success: true,
            message: 'Post updated successfully'
          });
          
        } catch (error) {
          featureLogger.error('Update post error:', error);
          res.status(500).json({ 
            error: 'Failed to update post' 
          });
        }
      }
    },
    
    // Delete Post
    {
      method: 'DELETE',
      path: '/posts/:id',
      secured: true,
      handler: async (req, res) => {
        try {
          const postId = req.params.id;
          const userId = req.user.userId;
          
          const db = container.get('db');
          
          // Check ownership
          const ownership = await db.query(
            'SELECT user_id, slug FROM posts WHERE id = $1',
            [postId]
          );
          
          if (ownership.rows.length === 0) {
            return res.status(404).json({ 
              error: 'Post not found' 
            });
          }
          
          if (ownership.rows[0].user_id !== userId) {
            return res.status(403).json({ 
              error: 'Not authorized to delete this post' 
            });
          }
          
          // Delete post
          await db.query('DELETE FROM posts WHERE id = $1', [postId]);
          
          // Clear cache
          const cache = container.get('cache');
          await cache.clearPattern('posts:*');
          await cache.del(`post:${ownership.rows[0].slug}`);
          await cache.del(`user:${userId}:posts`);
          
          // Emit event
          await eventBus.emit('post.deleted', { postId, userId });
          
          res.json({
            success: true,
            message: 'Post deleted successfully'
          });
          
        } catch (error) {
          featureLogger.error('Delete post error:', error);
          res.status(500).json({ 
            error: 'Failed to delete post' 
          });
        }
      }
    },
    
    // Upload Post Image
    {
      method: 'POST',
      path: '/posts/:id/upload',
      secured: true,
      handler: async (req, res) => {
        try {
          if (!req.file) {
            return res.status(400).json({ 
              error: 'No file uploaded' 
            });
          }
          
          const postId = req.params.id;
          const userId = req.user.userId;
          const file = req.file;
          
          const db = container.get('db');
          
          // Check ownership
          const ownership = await db.query(
            'SELECT user_id FROM posts WHERE id = $1',
            [postId]
          );
          
          if (ownership.rows.length === 0) {
            return res.status(404).json({ 
              error: 'Post not found' 
            });
          }
          
          if (ownership.rows[0].user_id !== userId) {
            return res.status(403).json({ 
              error: 'Not authorized' 
            });
          }
          
          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ 
              error: 'Invalid file type. Only images are allowed' 
            });
          }
          
          // Validate file size (max 10MB)
          if (file.size > parseInt(process.env.MAX_IMAGE_SIZE || 10485760)) {
            return res.status(400).json({ 
              error: 'File too large. Max size is 10MB' 
            });
          }
          
          // Optimize image with sharp
          const optimizedBuffer = await sharp(file.buffer)
            .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          
          // Upload to Cloudinary
          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.v2.uploader.upload_stream(
              {
                folder: 'post-master/posts',
                public_id: `post_${postId}_${Date.now()}`,
                overwrite: true,
                resource_type: 'image'
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            
            uploadStream.end(optimizedBuffer);
          });
          
          // Update post with image URL
          await db.query(
            'UPDATE posts SET featured_image = $1, updated_at = NOW() WHERE id = $2',
            [uploadResult.secure_url, postId]
          );
          
          // Clear cache
          await container.get('cache').clearPattern('posts:*');
          await container.get('cache').clearPattern(`post:*`);
          
          res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
              url: uploadResult.secure_url,
              publicId: uploadResult.public_id,
              format: uploadResult.format,
              width: uploadResult.width,
              height: uploadResult.height
            }
          });
          
        } catch (error) {
          featureLogger.error('Upload image error:', error);
          res.status(500).json({ 
            error: 'Failed to upload image' 
          });
        }
      }
    },
    
    // Like/Unlike Post
    {
      method: 'POST',
      path: '/posts/:id/like',
      secured: true,
      handler: async (req, res) => {
        try {
          const postId = req.params.id;
          const userId = req.user.userId;
          
          const db = container.get('db');
          
          // Check if post exists
          const post = await db.query(
            'SELECT id FROM posts WHERE id = $1',
            [postId]
          );
          
          if (post.rows.length === 0) {
            return res.status(404).json({ 
              error: 'Post not found' 
            });
          }
          
          // Check if already liked
          const existingLike = await db.query(
            'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
          );
          
          if (existingLike.rows.length > 0) {
            // Unlike
            await db.query(
              'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
              [postId, userId]
            );
            
            // Emit event
            await eventBus.emit('post.unliked', { postId, userId });
            
            res.json({
              success: true,
              message: 'Post unliked',
              liked: false
            });
          } else {
            // Like
            await db.query(
              'INSERT INTO likes (post_id, user_id) VALUES ($1, $2)',
              [postId, userId]
            );
            
            // Emit event
            await eventBus.emit('post.liked', { postId, userId });
            
            res.json({
              success: true,
              message: 'Post liked',
              liked: true
            });
          }
          
          // Clear cache
          await container.get('cache').clearPattern('posts:*');
          await container.get('cache').clearPattern(`post:*`);
          
        } catch (error) {
          featureLogger.error('Like post error:', error);
          res.status(500).json({ 
            error: 'Failed to process like' 
          });
        }
      }
    },
    
    // Get Post Comments
    {
      method: 'GET',
      path: '/posts/:id/comments',
      secured: false,
      handler: async (req, res) => {
        try {
          const postId = req.params.id;
          const { page = 1, limit = 20 } = req.query;
          const offset = (page - 1) * limit;
          
          const db = container.get('db');
          
          const result = await db.query(
            `SELECT 
              c.*,
              u.name as author_name,
              u.avatar_url as author_avatar
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.post_id = $1 AND c.is_approved = true
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3`,
            [postId, limit, offset]
          );
          
          // Get total count
          const countResult = await db.query(
            'SELECT COUNT(*) FROM comments WHERE post_id = $1 AND is_approved = true',
            [postId]
          );
          
          const total = parseInt(countResult.rows[0].count);
          
          res.json({
            success: true,
            data: result.rows,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total,
              totalPages: Math.ceil(total / limit)
            }
          });
          
        } catch (error) {
          featureLogger.error('Get comments error:', error);
          res.status(500).json({ 
            error: 'Failed to fetch comments' 
          });
        }
      }
    },
    
    // Add Comment
    {
      method: 'POST',
      path: '/posts/:id/comments',
      secured: true,
      handler: async (req, res) => {
        try {
          const postId = req.params.id;
          const userId = req.user.userId;
          const { content, parentId } = req.body;
          
          if (!content || content.trim().length === 0) {
            return res.status(400).json({ 
              error: 'Comment content is required' 
            });
          }
          
          const db = container.get('db');
          
          // Check if post exists
          const post = await db.query(
            'SELECT id, user_id FROM posts WHERE id = $1',
            [postId]
          );
          
          if (post.rows.length === 0) {
            return res.status(404).json({ 
              error: 'Post not found' 
            });
          }
          
          // Check parent comment if provided
          if (parentId) {
            const parent = await db.query(
              'SELECT id FROM comments WHERE id = $1 AND post_id = $2',
              [parentId, postId]
            );
            
            if (parent.rows.length === 0) {
              return res.status(400).json({ 
                error: 'Parent comment not found' 
              });
            }
          }
          
          const commentId = uuidv4();
          
          // Create comment
          await db.query(
            `INSERT INTO comments (id, post_id, user_id, parent_id, content)
             VALUES ($1, $2, $3, $4, $5)`,
            [commentId, postId, userId, parentId || null, content]
          );
          
          // Get created comment with author info
          const result = await db.query(
            `SELECT 
              c.*,
              u.name as author_name,
              u.avatar_url as author_avatar
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = $1`,
            [commentId]
          );
          
          // Clear cache
          await container.get('cache').clearPattern(`post:${postId}:comments:*`);
          
          // Emit event
          await eventBus.emit('comment.created', {
            commentId,
            postId,
            userId,
            postAuthorId: post.rows[0].user_id,
            content
          });
          
          res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: result.rows[0]
          });
          
        } catch (error) {
          featureLogger.error('Add comment error:', error);
          res.status(500).json({ 
            error: 'Failed to add comment' 
          });
        }
      }
    }
  ]);
  
  // ==================== EVENT LISTENERS ====================
  eventBus.on('post.created', async (data) => {
    featureLogger.info(`New post created: ${data.title} by ${data.userId}`);
    
    // Send notification to followers
    try {
      // Implementation for follower notifications
      featureLogger.debug(`Post creation notification sent for: ${data.postId}`);
    } catch (error) {
      featureLogger.error('Failed to send post creation notification:', error);
    }
  });
  
  eventBus.on('post.liked', async (data) => {
    featureLogger.info(`Post ${data.postId} liked by ${data.userId}`);
    
    // Send notification to post author
    try {
      const db = container.get('db');
      const post = await db.query(
        'SELECT user_id, title FROM posts WHERE id = $1',
        [data.postId]
      );
      
      if (post.rows.length > 0) {
        const authorId = post.rows[0].user_id;
        
        // Don't notify if user liked their own post
        if (authorId !== data.userId) {
          await eventBus.emit('notification.create', {
            userId: authorId,
            type: 'post_like',
            title: 'New Like',
            message: `Someone liked your post "${post.rows[0].title}"`,
            data: { postId: data.postId, likerId: data.userId }
          });
        }
      }
    } catch (error) {
      featureLogger.error('Failed to process like notification:', error);
    }
  });
  
  eventBus.on('comment.created', async (data) => {
    featureLogger.info(`New comment on post ${data.postId} by ${data.userId}`);
    
    // Send notification to post author (if commenter is not the author)
    if (data.userId !== data.postAuthorId) {
      await eventBus.emit('notification.create', {
        userId: data.postAuthorId,
        type: 'post_comment',
        title: 'New Comment',
        message: `Someone commented on your post`,
        data: { postId: data.postId, commentId: data.commentId }
      });
    }
  });
  
  // ==================== HELPER FUNCTIONS ====================
  function generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  featureLogger.info('✅ Post feature initialized');
  
  return {
    name: 'post',
    version: '1.0.0',
    description: 'Post management feature',
    
    cleanup: async () => {
      featureLogger.info('Cleaning up post feature');
      // Remove event listeners
      eventBus.off('post.created');
      eventBus.off('post.liked');
      eventBus.off('comment.created');
    }
  };
}