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

    async fetchAndSaveRecording(sessionId: number): Promise<string | null> {
        console.log(`=== fetchAndSaveRecording called for session ${sessionId} ===`);

        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true }
                        }
                    }
                }
            },
        });

        console.log(`Session found:`, session ? 'YES' : 'NO');
        console.log(`GoogleEventId:`, session?.googleEventId);
        console.log(`Tutor email:`, session?.class?.tutor?.user?.email);
        console.log(`Tutor has refresh token:`, !!session?.class?.tutor?.user?.googleRefreshToken);

        if (!session?.googleEventId) {
            this.logger.warn(`Session ${sessionId} has no googleEventId. Skipping.`);
            return null;
        }

        // Build list of users to search — tutor first, then fallback to admin
        const usersToSearch: { email: string; googleRefreshToken: string | null; googleAccessToken: string | null }[] = [];

        // 1. Try tutor first (they are the meeting organizer/recorder)
        if (session.class?.tutor?.user?.googleRefreshToken) {
            usersToSearch.push(session.class.tutor.user);
        }

        // 2. Fallback to any admin with tokens
        const adminUser = await this.prisma.user.findFirst({
            where: { NOT: { googleRefreshToken: null } },
        });
        if (adminUser) usersToSearch.push(adminUser);

        if (usersToSearch.length === 0) {
            this.logger.warn('No user with Google credentials found.');
            return null;
        }

        // search last 7 days for testing
        const now = new Date();
        const sessionEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const windowEnd = new Date();

        console.log(`Looking for recordings between: ${sessionEnd} and ${windowEnd}`);

        // Search each user's Drive until we find the recording
        for (const user of usersToSearch) {
            this.logger.log(`Searching Drive for user: ${user.email}`);

            this.oauth2Client.setCredentials({
                refresh_token: user.googleRefreshToken,
                access_token: user.googleAccessToken,
            });

            const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

            try {
                const response = await drive.files.list({
                    q: `mimeType='video/mp4' and trashed=false`,
                    fields: 'files(id, name, webViewLink, createdTime)',
                    orderBy: 'createdTime desc',
                    pageSize: 20,
                });

                const files = response.data.files || [];
                this.logger.log(`Found ${files.length} mp4 file(s) in ${user.email}'s Drive`);

                const matched = files.find((file) => {
                    const created = new Date(file.createdTime!);
                    console.log(`File: ${file.name}, created: ${created}`);
                    return created >= sessionEnd && created <= windowEnd;
                });

                if (matched) {
                    await this.prisma.session.update({
                        where: { id: sessionId },
                        data: {
                            recordingUrl: matched.webViewLink,
                            recordingFileId: matched.id,
                            recordingStatus: 'SAVED',
                        },
                    });

                    this.logger.log(`Recording saved for session ${sessionId}: ${matched.webViewLink}`);
                    return matched.webViewLink!;
                }

            } catch (error: any) {
                this.logger.error(`Failed to search Drive for ${user.email}: ${error.message}`);
            }
        }

        // Nothing found in any Drive
        this.logger.warn(`No recording found for session ${sessionId}`);
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { recordingStatus: 'NOT_FOUND' },
        });
        return null;
    }
}
