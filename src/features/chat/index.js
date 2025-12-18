import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../shared/logger.js';

export async function register(core) {
  const { app, container, eventBus, router, logger } = core;
  
  const featureLogger = logger.child({ module: 'chat' });
  featureLogger.info('💬 Initializing chat feature...');
  
  // Socket.IO Server
  const io = new Server({
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  
  // Attach to HTTP server
  const httpServer = app.get('httpServer') || require('http').createServer(app);
  if (!app.get('httpServer')) {
    app.set('httpServer', httpServer);
  }
  
  io.attach(httpServer);
  
  // Online users map
  const onlineUsers = new Map();
  
  // ==================== SOCKET.IO EVENTS ====================
  io.on('connection', (socket) => {
    featureLogger.info(`New socket connection: ${socket.id}`);
    
    // Authenticate user
    socket.on('authenticate', async (token) => {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const userId = decoded.userId;
        
        // Store user-socket mapping
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        
        // Join user room
        socket.join(`user:${userId}`);
        
        // Broadcast online status
        socket.broadcast.emit('user:online', { userId });
        
        // Send online users list
        const onlineUserIds = Array.from(onlineUsers.keys());
        socket.emit('users:online', onlineUserIds);
        
        featureLogger.info(`User ${userId} authenticated on socket ${socket.id}`);
        
      } catch (error) {
        featureLogger.error('Socket authentication error:', error);
        socket.emit('error', { message: 'Authentication failed' });
        socket.disconnect();
      }
    });
    
    // Send message
    socket.on('message:send', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        
        const { receiverId, content, type = 'text' } = data;
        
        if (!receiverId || !content) {
          socket.emit('error', { message: 'Receiver ID and content are required' });
          return;
        }
        
        const db = container.get('db');
        const messageId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // Save message to database
        await db.query(
          `INSERT INTO chat_messages (
            id, sender_id, receiver_id, content, message_type, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            messageId,
            socket.userId,
            receiverId,
            content,
            type,
            false,
            timestamp
          ]
        );
        
        // Get sender info
        const senderResult = await db.query(
          'SELECT name, avatar_url FROM users WHERE id = $1',
          [socket.userId]
        );
        
        const sender = senderResult.rows[0] || {};
        
        // Prepare message object
        const message = {
          id: messageId,
          senderId: socket.userId,
          receiverId,
          content,
          type,
          isRead: false,
          createdAt: timestamp,
          senderName: sender.name,
          senderAvatar: sender.avatar_url
        };
        
        // Emit to receiver if online
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message:receive', message);
          // Mark as read immediately
          await db.query(
            'UPDATE chat_messages SET is_read = true WHERE id = $1',
            [messageId]
          );
          message.isRead = true;
        }
        
        // Emit back to sender
        socket.emit('message:sent', message);
        
        // Emit event for notifications
        await eventBus.emit('chat.message.sent', {
          messageId,
          senderId: socket.userId,
          receiverId,
          content
        });
        
      } catch (error) {
        featureLogger.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Typing indicator
    socket.on('typing:start', (data) => {
      if (!socket.userId) return;
      
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:start', {
          senderId: socket.userId
        });
      }
    });
    
    socket.on('typing:stop', (data) => {
      if (!socket.userId) return;
      
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:stop', {
          senderId: socket.userId
        });
      }
    });
    
    // Read receipt
    socket.on('message:read', async (data) => {
      try {
        if (!socket.userId) return;
        
        const { messageId } = data;
        const db = container.get('db');
        
        // Mark message as read
        await db.query(
          'UPDATE chat_messages SET is_read = true WHERE id = $1 AND receiver_id = $2',
          [messageId, socket.userId]
        );
        
        // Get message details
        const messageResult = await db.query(
          'SELECT sender_id FROM chat_messages WHERE id = $1',
          [messageId]
        );
        
        if (messageResult.rows.length > 0) {
          const senderId = messageResult.rows[0].sender_id;
          const senderSocketId = onlineUsers.get(senderId);
          
          // Notify sender
          if (senderSocketId) {
            io.to(senderSocketId).emit('message:read', { messageId });
          }
        }
        
      } catch (error) {
        featureLogger.error('Read receipt error:', error);
      }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        socket.broadcast.emit('user:offline', { userId: socket.userId });
        featureLogger.info(`User ${socket.userId} disconnected`);
      }
    });
  });
  
  // ==================== HTTP ROUTES ====================
  router.register('chat', [
    // Get conversations
    {
      method: 'GET',
      path: '/chat/conversations',
      secured: true,
      handler: async (req, res) => {
        try {
          const userId = req.user.userId;
          const db = container.get('db');
          
          const result = await db.query(
            `SELECT DISTINCT 
              CASE 
                WHEN sender_id = $1 THEN receiver_id
                ELSE sender_id
              END as participant_id,
              MAX(cm.created_at) as last_message_time
            FROM chat_messages cm
            WHERE sender_id = $1 OR receiver_id = $1
            GROUP BY participant_id
            ORDER BY last_message_time DESC`,
            [userId]
          );
          
          // Get participant details
          const conversations = [];
          
          for (const row of result.rows) {
            const participantId = row.participant_id;
            
            // Get participant info
            const userResult = await db.query(
              'SELECT id, name, email, avatar_url, is_active FROM users WHERE id = $1',
              [participantId]
            );
            
            if (userResult.rows.length > 0) {
              const user = userResult.rows[0];
              
              // Get last message
              const lastMessageResult = await db.query(
                `SELECT content, message_type, created_at, is_read 
                 FROM chat_messages 
                 WHERE (sender_id = $1 AND receiver_id = $2) 
                    OR (sender_id = $2 AND receiver_id = $1)
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId, participantId]
              );
              
              // Count unread messages
              const unreadCountResult = await db.query(
                `SELECT COUNT(*) 
                 FROM chat_messages 
                 WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`,
                [participantId, userId]
              );
              
              conversations.push({
                participant: {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  avatar: user.avatar_url,
                  isActive: user.is_active,
                  isOnline: onlineUsers.has(user.id)
                },
                lastMessage: lastMessageResult.rows[0] || null,
                unreadCount: parseInt(unreadCountResult.rows[0].count) || 0,
                lastActivity: row.last_message_time
              });
            }
          }
          
          res.json({
            success: true,
            data: conversations
          });
          
        } catch (error) {
          featureLogger.error('Get conversations error:', error);
          res.status(500).json({ 
            error: 'Failed to fetch conversations' 
          });
        }
      }
    },
    
    // Get messages
    {
      method: 'GET',
      path: '/chat/messages/:userId',
      secured: true,
      handler: async (req, res) => {
        try {
          const currentUserId = req.user.userId;
          const otherUserId = req.params.userId;
          const { before, limit = 50 } = req.query;
          
          const db = container.get('db');
          
          let query = `
            SELECT 
              cm.*,
              sender.name as sender_name,
              sender.avatar_url as sender_avatar,
              receiver.name as receiver_name,
              receiver.avatar_url as receiver_avatar
            FROM chat_messages cm
            LEFT JOIN users sender ON cm.sender_id = sender.id
            LEFT JOIN users receiver ON cm.receiver_id = receiver.id
            WHERE (cm.sender_id = $1 AND cm.receiver_id = $2)
               OR (cm.sender_id = $2 AND cm.receiver_id = $1)
          `;
          
          const params = [currentUserId, otherUserId];
          
          if (before) {
            query += ' AND cm.created_at < $3';
            params.push(before);
          }
          
          query += ' ORDER BY cm.created_at DESC LIMIT $' + (params.length + 1);
          params.push(limit);
          
          const result = await db.query(query, params);
          
          // Mark messages as read
          await db.query(
            `UPDATE chat_messages 
             SET is_read = true 
             WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`,
            [otherUserId, currentUserId]
          );
          
          res.json({
            success: true,
            data: result.rows.reverse() // Return in chronological order
          });
          
        } catch (error) {
          featureLogger.error('Get messages error:', error);
          res.status(500).json({ 
            error: 'Failed to fetch messages' 
          });
        }
      }
    },
    
    // Search users for chat
    {
      method: 'GET',
      path: '/chat/users/search',
      secured: true,
      handler: async (req, res) => {
        try {
          const { q, excludeCurrent = true } = req.query;
          const userId = req.user.userId;
          
          if (!q || q.length < 2) {
            return res.status(400).json({ 
              error: 'Search query must be at least 2 characters' 
            });
          }
          
          const db = container.get('db');
          
          let query = `
            SELECT id, name, email, avatar_url, bio, is_active
            FROM users
            WHERE (name ILIKE $1 OR email ILIKE $1)
              AND is_active = true
          `;
          
          const params = [`%${q}%`];
          
          if (excludeCurrent === 'true') {
            query += ' AND id != $2';
            params.push(userId);
          }
          
          query += ' ORDER BY name LIMIT 20';
          
          const result = await db.query(query, params);
          
          // Add online status
          const users = result.rows.map(user => ({
            ...user,
            isOnline: onlineUsers.has(user.id)
          }));
          
          res.json({
            success: true,
            data: users
          });
          
        } catch (error) {
          featureLogger.error('Search users error:', error);
          res.status(500).json({ 
            error: 'Failed to search users' 
          });
        }
      }
    },
    
    // Delete conversation
    {
      method: 'DELETE',
      path: '/chat/conversations/:userId',
      secured: true,
      handler: async (req, res) => {
        try {
          const currentUserId = req.user.userId;
          const otherUserId = req.params.userId;
          
          const db = container.get('db');
          
          await db.query(
            `DELETE FROM chat_messages 
             WHERE (sender_id = $1 AND receiver_id = $2)
                OR (sender_id = $2 AND receiver_id = $1)`,
            [currentUserId, otherUserId]
          );
          
          res.json({
            success: true,
            message: 'Conversation deleted successfully'
          });
          
        } catch (error) {
          featureLogger.error('Delete conversation error:', error);
          res.status(500).json({ 
            error: 'Failed to delete conversation' 
          });
        }
      }
    }
  ]);
  
  // ==================== EVENT LISTENERS ====================
  eventBus.on('chat.message.sent', async (data) => {
    featureLogger.info(`Chat message sent: ${data.messageId}`);
    
    // Create notification for receiver if not online
    const receiverSocketId = onlineUsers.get(data.receiverId);
    
    if (!receiverSocketId) {
      await eventBus.emit('notification.create', {
        userId: data.receiverId,
        type: 'chat_message',
        title: 'New Message',
        message: `You have a new message`,
        data: { 
          senderId: data.senderId, 
          messageId: data.messageId,
          preview: data.content.substring(0, 100)
        }
      });
    }
  });
  
  featureLogger.info('✅ Chat feature initialized');
  
  return {
    name: 'chat',
    version: '1.0.0',
    description: 'Real-time chat feature',
    io: io, // Export socket.io instance
    
    cleanup: async () => {
      featureLogger.info('Cleaning up chat feature');
      io.close();
      onlineUsers.clear();
    }
  };
}