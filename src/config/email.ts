import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email transporter verification failed:', error);
  } else {
    logger.info('✅ Email server is ready to send messages');
  }
});

// Email templates
export const emailTemplates = {
  welcome: (name: string, verificationLink: string) => ({
    subject: 'Welcome to Post-Master! Please verify your email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to Post-Master, ${name}!</h2>
        <p>Thank you for joining our community. We're excited to have you on board.</p>
        <p>Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p style="word-break: break-all; color: #4F46E5;">${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          If you didn't create an account, please ignore this email.
        </p>
      </div>
    `
  }),

  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Reset Your Post-Master Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #DC2626; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p style="word-break: break-all; color: #DC2626;">${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">For security reasons, this link can only be used once.</p>
      </div>
    `
  }),

  notification: (name: string, message: string, actionLink?: string) => ({
    subject: 'New Notification from Post-Master',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Hello ${name}!</h2>
        <p>${message}</p>
        ${actionLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" 
               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Now
            </a>
          </div>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          You can manage your notification preferences in your account settings.
        </p>
      </div>
    `
  })
};

// Send email function
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  from: string = process.env.EMAIL_FROM || 'noreply@postmaster.com'
): Promise<boolean> => {
  try {
    const mailOptions = {
      from,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
};

export { transporter };