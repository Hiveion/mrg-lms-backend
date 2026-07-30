import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../Services/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL!,
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/meetings.space.readonly'],
            accessType: 'offline',
            prompt: 'consent',
        } as any);
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        try {
            console.log('Google Auth Strategy Validate:');
            console.log('Access Token exists:', !!accessToken);
            console.log('Refresh Token exists:', !!refreshToken);
            console.log('Google Profile received:', profile?.id, profile?.emails);

            const { name, emails, photos } = profile || {};
            const user = {
                email: emails?.[0]?.value || profile?._json?.email || '',
                firstName: name?.givenName || profile?._json?.given_name || profile?.displayName || '',
                lastName: name?.familyName || profile?._json?.family_name || '',
                picture: photos?.[0]?.value || profile?._json?.picture || null,
                googleId: profile?.id,
                accessToken,
                refreshToken,
            };
            done(null, user);
        } catch (error) {
            console.error('Error in GoogleStrategy validate:', error);
            done(error as any, false);
        }
    }
}
