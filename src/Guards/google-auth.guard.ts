import { Injectable, UnauthorizedException } from '@nestjs/common';
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
            console.error('Google Auth Guard Error:', err || info);
            const errorMsg = err?.message || info?.message || 'Google authentication failed';
            throw err || new UnauthorizedException(errorMsg);
        }
        return user;
    }
}
