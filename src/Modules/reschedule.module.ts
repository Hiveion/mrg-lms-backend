import { Module } from '@nestjs/common';
import { RescheduleController } from '../Controllers/reschedule.controller';
import { RescheduleService } from '../Services/reschedule.service';
import { PrismaService } from '../Database/prisma.service';

@Module({
    controllers: [RescheduleController],
    providers: [RescheduleService, PrismaService],
    exports: [RescheduleService],
})
export class RescheduleModule { }
