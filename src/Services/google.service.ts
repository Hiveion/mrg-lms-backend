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

    async createCalendarEvent(adminId: number, session: any, studentEmails: string[], tutorEmail: string, titlePrefix?: string) {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
        });

        if (!admin?.googleRefreshToken) {
            // Fallback to Main Admin (ID 24/First one found) if current user has no tokens
            const fallbackAdmin = await this.prisma.user.findFirst({
                where: { NOT: { googleRefreshToken: null } }
            });

            if (!fallbackAdmin?.googleRefreshToken) {
                this.logger.warn(`No user has linked their Google Calendar. Skipping calendar event creation.`);
                return null;
            }
            this.oauth2Client.setCredentials({
                refresh_token: fallbackAdmin.googleRefreshToken,
                access_token: fallbackAdmin.googleAccessToken,
            });
        } else {
            this.oauth2Client.setCredentials({
                refresh_token: admin.googleRefreshToken,
                access_token: admin.googleAccessToken,
            });
        }

        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        const startTime = new Date(session.dateTime);
        const endTime = new Date(startTime.getTime() + (session.duration || 60) * 60 * 1000);

        const attendees = [
            { email: tutorEmail },
            ...studentEmails.map(email => ({ email })),
        ];

        const summary = `${titlePrefix ? titlePrefix + ': ' : ''}Class: ${session.class.subject.name} - ${session.class.name}`;

        const event = {
            summary,
            description: `Class session for ${session.class.subject.name}. ${titlePrefix ? '(' + titlePrefix + ')' : ''}`,
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
                sendUpdates: 'all',
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
            this.logger.error(`Failed to create Google Calendar event: ${error.message}`);
            return null;
        }
    }

    async updateCalendarEvent(adminId: number, session: any, studentEmails: string[], tutorEmail: string) {
        if (!session.googleEventId) {
            return this.createCalendarEvent(adminId, session, studentEmails, tutorEmail);
        }

        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
        });

        if (!admin?.googleRefreshToken) {
            const fallbackAdmin = await this.prisma.user.findFirst({
                where: { NOT: { googleRefreshToken: null } }
            });
            if (!fallbackAdmin?.googleRefreshToken) return null;

            this.oauth2Client.setCredentials({
                refresh_token: fallbackAdmin.googleRefreshToken,
                access_token: fallbackAdmin.googleAccessToken,
            });
        } else {
            this.oauth2Client.setCredentials({
                refresh_token: admin.googleRefreshToken,
                access_token: admin.googleAccessToken,
            });
        }

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
                sendUpdates: 'all',
                requestBody: {
                    summary: `Class: ${session.class.subject.name} - ${session.class.name}`,
                    start: { dateTime: startTime.toISOString() },
                    end: { dateTime: endTime.toISOString() },
                    attendees,
                },
            });

            const meetLink = response.data.hangoutLink;
            // Optionally update the session link in DB if a session ID is provided
            if (meetLink && session.id) {
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

        if (!admin?.googleRefreshToken) {
            const fallbackAdmin = await this.prisma.user.findFirst({
                where: { NOT: { googleRefreshToken: null } }
            });
            if (!fallbackAdmin?.googleRefreshToken) return;

            this.oauth2Client.setCredentials({
                refresh_token: fallbackAdmin.googleRefreshToken,
                access_token: fallbackAdmin.googleAccessToken,
            });
        } else {
            this.oauth2Client.setCredentials({
                refresh_token: admin.googleRefreshToken,
                access_token: admin.googleAccessToken,
            });
        }

        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        try {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: googleEventId,
                sendUpdates: 'all',
            });
        } catch (error) {
            this.logger.error(`Failed to delete Google Calendar event: ${error.message}`);
        }
    }
}
