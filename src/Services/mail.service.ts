import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) { }

  async sendUserInvitation(email: string, role?: string, token?: string) {
    const url = `${process.env.FRONTEND_URL}/auth?tab=register&email=${encodeURIComponent(email)}${role ? `&role=${role.toLowerCase()}` : ''}${token ? `&token=${token}` : ''}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Welcome to MRG LMS - You are Invited!',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Join MRG LMS</h2>
          <p>Hello,</p>
          <p>You have been invited to join the <strong>MRG LMS</strong> platform${role ? ` as a <strong>${role}</strong>` : ''}.</p>
          <p>This invitation is valid for <strong>4 hours</strong>.</p>
          <p>To get started, please click the button below to complete your registration:</p>
          <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Complete Registration</a>
          <p>Or copy and paste this link in your browser:</p>
          <p>${url}</p>
          <br>
          <p>Best regards,<br>The MRG LMS Team</p>
        </div>
      `,
    });
  }

  async sendAdminCreatedAccount(email: string, password: string, role: string) {
    const loginUrl = `${process.env.FRONTEND_URL}/auth?tab=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Your MRG LMS Account has been Created!',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Welcome to MRG LMS</h2>
          <p>Hello,</p>
          <p>An administrator has created an account for you as a <strong>${role}</strong>.</p>
          <p>Here are your temporary login details:</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Temporary Password:</strong> ${password}</li>
          </ul>
          <p><strong>Note:</strong> You will be required to change your password upon your first login.</p>
          <a href="${loginUrl}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Login Now</a>
          <br><br>
          <p>Best regards,<br>The MRG LMS Team</p>
        </div>
      `,
    });
  }

  async sendApprovalEmail(email: string, firstName: string) {
    const loginUrl = `${process.env.FRONTEND_URL}/auth?tab=login&email=${encodeURIComponent(email)}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Congratulations! Your MRG LMS Account is Approved',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Account Approved</h2>
          <p>Hello ${firstName},</p>
          <p>Your account on the <strong>MRG LMS</strong> platform has been approved by the administrator.</p>
          <p>You can now log in and access your dashboard to start your journey with us.</p>
          <a href="${loginUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
          <br><br>
          <p>Best regards,<br>The MRG LMS Team</p>
        </div>
      `,
    });
  }

  async sendRejectionEmail(email: string, firstName: string, reason?: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Update regarding your MRG LMS Application',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Application Update</h2>
          <p>Hello ${firstName || 'Valued User'},</p>
          <p>Thank you for your interest in <strong>MRG LMS</strong>.</p>
          <p>After reviewing your application, we regret to inform you that we are unable to approve your account at this time.</p>
          ${reason ? `<div style="background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 10px; margin: 15px 0; border-radius: 4px;">
              <strong>Reason:</strong> ${reason}
          </div>` : ''}
          <p>If you have any questions or believe this was a mistake, please contact our support team.</p>
          <br>
          <p>Best regards,<br>The MRG LMS Team</p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/auth?tab=reset-password&token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request - MRG LMS',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Forgot Your Password?</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password for your <strong>MRG LMS</strong> account.</p>
          <p>This link is valid for <strong>1 hour</strong>.</p>
          <p>Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you did not request a password reset, please ignore this email.</p>
          <br>
          <p>Best regards,<br>The MRG LMS Team</p>
        </div>
      `,
    });
  }
}
