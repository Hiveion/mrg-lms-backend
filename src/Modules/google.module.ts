import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleService } from '../Services/google.service';
import { RecordingScheduler } from '../Services/recording.scheduler';
import { PrismaService } from '../Database/prisma.service';

@Module({
    imports: [ScheduleModule.forRoot()],
    providers: [GoogleService, RecordingScheduler, PrismaService],
    exports: [GoogleService],
})
export class GoogleModule { }
