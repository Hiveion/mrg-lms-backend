import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) { }

    async sendUserInvitation(email: string, role?: string) {
        const url = `${process.env.FRONTEND_URL}/auth?tab=register&email=${email}${role ? `&role=${role.toLowerCase()}` : ''}`;

        await this.mailerService.sendMail({
            to: email,
            subject: 'Welcome to MRG LMS - You are Invited!',
            html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2>Join MRG LMS</h2>
          <p>Hello,</p>
          <p>You have been invited to join the <strong>MRG LMS</strong> platform${role ? ` as a <strong>${role}</strong>` : ''}.</p>
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
        const loginUrl = `${process.env.FRONTEND_URL}/auth?tab=login&email=${email}`;

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
}
