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

    async createCalendarEvent(adminId: number, session: any, studentEmails: string[], tutorEmail: string) {
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

        const attendees = [
            { email: tutorEmail },
            ...studentEmails.map(email => ({ email })),
        ];

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
            attendees,
            conferenceData: {
                createRequest: {
                    requestId: `session-${session.id}-${Date.now()}`,
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
            const googleEventId = response.data.id;

            // Update session with link and event ID
            await this.prisma.session.update({
                where: { id: session.id },
                data: {
                    link: meetLink,
                    googleEventId: googleEventId
                },
            });

            return { meetLink, googleEventId };
        } catch (error) {
        }
    }

    async updateCalendarEvent(adminId: number, session: any, studentEmails: string[], tutorEmail: string) {
        if (!session.googleEventId) {
            return this.createCalendarEvent(adminId, session, studentEmails, tutorEmail);
        }

        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
        });

        if (!admin?.googleRefreshToken) return null;

        this.oauth2Client.setCredentials({
            refresh_token: admin.googleRefreshToken,
            access_token: admin.googleAccessToken,
        });

        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        const startTime = new Date(session.dateTime);
        const endTime = new Date(startTime.getTime() + (session.duration || 60) * 60 * 1000);

        const attendees = [
            { email: tutorEmail },
            ...studentEmails.map(email => ({ email })),
        ];

        try {
            const response = await calendar.events.patch({
                calendarId: 'primary',
                eventId: session.googleEventId,
                requestBody: {
                    summary: `Class: ${session.class.subject.name} - ${session.class.name}`,
                    start: { dateTime: startTime.toISOString() },
                    end: { dateTime: endTime.toISOString() },
                    attendees,
                },
            });

            const meetLink = response.data.hangoutLink;
            if (meetLink) {
                await this.prisma.session.update({
                    where: { id: session.id },
                    data: { link: meetLink },
                });
            }

            return meetLink;
        } catch (error) {
            this.logger.error(`Failed to update Google Calendar event: ${error.message}`);
            return null;
        }
    }

    async deleteCalendarEvent(adminId: number, googleEventId: string) {
        if (!googleEventId) return;

        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
        });

        if (!admin?.googleRefreshToken) return;

        this.oauth2Client.setCredentials({
            refresh_token: admin.googleRefreshToken,
            access_token: admin.googleAccessToken,
        });

        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        try {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: googleEventId,
            });
        } catch (error) {
            this.logger.error(`Failed to delete Google Calendar event: ${error.message}`);
        }
    }
}
