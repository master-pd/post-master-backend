import { sendEmail, emailTemplates } from '../config/email';
import { logger } from '../utils/logger';

export class EmailService {
  // Send welcome email
  static async sendWelcomeEmail(
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

  // Send notification email
  static async sendNotificationEmail(
    email: string,
    username: string,
    notification: {
      type: string;
      message: string;
      actionLink?: string;
    }
  ): Promise<boolean> {
    return await sendEmail(
      email,
      emailTemplates.notification(username, notification.message, notification.actionLink).subject,
      emailTemplates.notification(username, notification.message, notification.actionLink).html
    );
  }

  // Send custom email
  static async sendCustomEmail(
    to: string,
    subject: string,
    html: string,
    from?: string
  ): Promise<boolean> {
    return await sendEmail(to, subject, html, from);
  }

  // Send bulk emails (with rate limiting)
  static async sendBulkEmails(
    emails: Array<{
      to: string;
      subject: string;
      html: string;
    }>,
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<Array<{ email: string; success: boolean; error?: string }>> {
    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(async (email) => {
        try {
          const success = await sendEmail(email.to, email.subject, email.html);
          return {
            email: email.to,
            success,
            error: success ? undefined : 'Failed to send email'
          };
        } catch (error: any) {
          return {
            email: email.to,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches to avoid rate limiting
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  // Verify email template
  static async verifyEmailTemplate(
    templateName: string,
    data: any
  ): Promise<{ valid: boolean; preview?: string; error?: string }> {
    try {
      let template: any;

      switch (templateName) {
        case 'welcome':
          template = emailTemplates.welcome(data.username, data.verificationLink);
          break;
        case 'passwordReset':
          template = emailTemplates.passwordReset(data.username, data.resetLink);
          break;
        case 'notification':
          template = emailTemplates.notification(data.username, data.message, data.actionLink);
          break;
        default:
          return {
            valid: false,
            error: `Template '${templateName}' not found`
          };
      }

      return {
        valid: true,
        preview: template.html
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Get email statistics (would connect to email service API)
  static async getEmailStats(): Promise<any> {
    // In a real application, this would connect to your email service provider's API
    // to get statistics like delivery rates, open rates, bounce rates, etc.
    
    return {
      sentToday: 0,
      deliveredToday: 0,
      openedToday: 0,
      bounceRate: 0,
      openRate: 0,
      clickRate: 0
    };
  }

  // Validate email address
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Extract domain from email
  static extractDomain(email: string): string | null {
    const match = email.match(/@(.+)$/);
    return match ? match[1] : null;
  }

  // Check if domain has MX records (would require DNS lookup)
  static async checkDomainHasMX(domain: string): Promise<boolean> {
    // In a real application, you would perform a DNS MX record lookup here
    // This is a simplified version
    const commonDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'aol.com', 'icloud.com', 'protonmail.com', 'zoho.com'
    ];

    // Check if it's a common domain
    if (commonDomains.includes(domain.toLowerCase())) {
      return true;
    }

    // For other domains, you might want to perform actual DNS lookup
    // For now, return true as a default
    return true;
  }
}