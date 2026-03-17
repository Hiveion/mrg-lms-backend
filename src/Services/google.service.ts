import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../Database/prisma.service';

@Injectable()
export class GoogleService {
    private readonly logger = new Logger(GoogleService.name);
    private oauth2Client;

    constructor(private prisma: PrismaService) {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL
        );
    }

    async createCalendarEvent(adminId: number, session: any, studentEmail: string, tutorEmail: string) {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
        });

        if (!admin?.googleRefreshToken) {
            this.logger.warn(`Admin ${adminId} has no Google Refresh Token. Skipping calendar event creation.`);
            return null;
        }

        this.oauth2Client.setCredentials({
            refresh_token: admin.googleRefreshToken,
            access_token: admin.googleAccessToken,
        });

        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        const startTime = new Date(session.dateTime);
        const endTime = new Date(startTime.getTime() + session.duration * 60 * 1000);

        const event = {
            summary: `Class: ${session.class.subject.name} - ${session.class.name}`,
            description: `Class session for ${session.class.subject.name}.`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'UTC',
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'UTC',
            },
            attendees: [
                { email: studentEmail },
                { email: tutorEmail },
            ],
            conferenceData: {
                createRequest: {
                    requestId: `session-${session.id}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 10 },
                ],
            },
        };

        try {
            const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
                conferenceDataVersion: 1,
            });

            const meetLink = response.data.hangoutLink;

            // Update session with link
            await this.prisma.session.update({
                where: { id: session.id },
                data: { link: meetLink },
            });

            return meetLink;
        } catch (error) {
            this.logger.error(`Failed to create Google Calendar event: ${error.message}`);
            // If unauthorized, token might be invalid/revoked
            return null;
        }
    }
}
