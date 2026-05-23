import { Module } from '@nestjs/common';
import { GoogleService } from '../Services/google.service';
import { RecordingScheduler } from '../Services/recording.scheduler';
import { PrismaService } from '../Database/prisma.service';

@Module({
    providers: [GoogleService, RecordingScheduler, PrismaService],
    exports: [GoogleService],
})
export class GoogleModule { }
