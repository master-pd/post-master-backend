import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.model';
import { sendEmail, emailTemplates } from '../config/email';
import { logger } from '../utils/logger';

export class AuthService {
  // Generate JWT Token
  static generateToken(userId: string): string {
    return jwt.sign(
      { id: userId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  // Generate Refresh Token
  static generateRefreshToken(userId: string): string {
    return jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
  }

  // Generate verification token
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate reset token
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Verify JWT Token
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Verify Refresh Token
  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET!);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Send verification email
  static async sendVerificationEmail(
    email: string, 
    username: string, 
    verificationToken: string
  ): Promise<boolean> {
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    return await sendEmail(
      email,
      emailTemplates.welcome(username, verificationLink).subject,
      emailTemplates.welcome(username, verificationLink).html
    );
  }

  // Send password reset email
  static async sendPasswordResetEmail(
    email: string, 
    username: string, 
    resetToken: string
  ): Promise<boolean> {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    return await sendEmail(
      email,
      emailTemplates.passwordReset(username, resetLink).subject,
      emailTemplates.passwordReset(username, resetLink).html
    );
  }

  // Validate user credentials
  static async validateCredentials(
    identifier: string, 
    password: string
  ): Promise<User | null> {
    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      return null;
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    return user;
  }

  // Check if email/username is available
  static async checkAvailability(
    email: string, 
    username: string
  ): Promise<{ emailAvailable: boolean; usernameAvailable: boolean }> {
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    return {
      emailAvailable: !existingUser?.email || existingUser.email !== email,
      usernameAvailable: !existingUser?.username || existingUser.username !== username
    };
  }

  // Create new user
  static async createUser(userData: any): Promise<User> {
    const verificationToken = this.generateVerificationToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      ...userData,
      verificationToken,
      verificationTokenExpires
    });

    // Send verification email
    const emailSent = await this.sendVerificationEmail(
      user.email,
      user.username,
      verificationToken
    );

    if (!emailSent) {
      logger.warn(`Verification email failed to send to ${user.email}`);
    }

    return user;
  }

  // Update user last login
  static async updateLastLogin(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      lastLogin: new Date()
    });
  }

  // Generate tokens for user
  static generateTokens(userId: string): { token: string; refreshToken: string } {
    return {
      token: this.generateToken(userId),
      refreshToken: this.generateRefreshToken(userId)
    };
  }
}