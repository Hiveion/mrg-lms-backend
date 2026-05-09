import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../Database/prisma.service';
import { GoogleService } from './google.service';
import { SessionRecordingStatus } from '@prisma/client';

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
        recordingUrl: null,
        recordingStatus: { not: SessionRecordingStatus.NOT_FOUND },
        dateTime: {
          gte: new Date(now.getTime() - 3 * 60 * 60 * 1000), // max 3 hrs ago
          lte: new Date(now.getTime() - 15 * 60 * 1000),     // at least 15 min ago
        },
      },
    });

    this.logger.log(`Checking recordings for ${recentSessions.length} session(s)`);

    for (const session of recentSessions) {
      await this.googleService.fetchAndSaveRecording(session.id);
    }
  }
}
