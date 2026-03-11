import { Module } from '@nestjs/common';
import { RescheduleController } from '../Controllers/reschedule.controller';
import { RescheduleService } from '../Services/reschedule.service';
import { DatabaseModule } from '../Database/database.module';
import { NotificationModule } from './notification.module';

@Module({
    imports: [DatabaseModule, NotificationModule],
    controllers: [RescheduleController],
    providers: [RescheduleService],
    exports: [RescheduleService],
})
export class RescheduleModule { }
