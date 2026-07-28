import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    constructor() {
        super({
            accessType: 'offline',
            prompt: 'consent',
        });
    }

    handleRequest(err: any, user: any, info: any, context: any) {
        if (err || !user) {
            const res = context.switchToHttp().getResponse();
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const errorMsg = err?.message || info?.message || 'Google authentication failed';
            res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent(errorMsg)}`);
            return null;
        }
        return user;
    }
}
