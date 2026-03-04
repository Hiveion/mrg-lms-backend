import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from '../Services/mail.service';

@Global()
@Module({
    imports: [
        MailerModule.forRoot({
            transport: {
                host: process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
                port: parseInt(process.env.MAIL_PORT || '587'),
                auth: {
                    user: process.env.MAIL_USER || '',
                    pass: process.env.MAIL_PASS || '',
                },
            },
            defaults: {
                from: process.env.MAIL_FROM || '"MRG LMS" <noreply@mrg-lms.com>',
            },
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }
