import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../Database/prisma.service';
import { GoogleService } from './google.service';
import { SessionRecordingStatus } from '@prisma/client';
import { SessionTranscriptStatus } from '@prisma/client';

@Injectable()
export class RecordingScheduler {
  private readonly logger = new Logger(RecordingScheduler.name);

  constructor(
    private prisma: PrismaService,
    private googleService: GoogleService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkForNewRecordings() {
    const now = new Date();

    const recentSessions = await this.prisma.session.findMany({
        where: {
            googleEventId: { not: null },
            dateTime: {
                gte: new Date(now.getTime() - 3 * 60 * 60 * 1000),
                lte: new Date(now.getTime() - 15 * 60 * 1000),
            },
            OR: [
                // recording
                {
                    recordingUrl: null,
                    recordingStatus: { not: SessionRecordingStatus.NOT_FOUND },
                },
                // transcript 
                {
                    transcriptUrl: null,
                    transcriptStatus: { not: SessionTranscriptStatus.NOT_FOUND },
                },
            ],
            
        },
    });

    this.logger.log(`Processing ${recentSessions.length} session(s) for recordings/transcripts`);


    for (const session of recentSessions) {
        // Fetch recording if not saved yet
        if (!session.recordingUrl && session.recordingStatus !== SessionRecordingStatus.NOT_FOUND) {
            await this.googleService.fetchAndSaveRecording(session.id);
        }

        // Fetch transcript if not saved yet 
        if (!session.transcriptUrl && session.transcriptStatus !== SessionTranscriptStatus.NOT_FOUND) {
            await this.googleService.fetchAndSaveTranscript(session.id);
        }
    }
  }
}
