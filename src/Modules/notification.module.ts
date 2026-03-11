import { Module } from '@nestjs/common';
import { NotificationService } from '../Services/notification.service';
import { NotificationController } from '../Controllers/notification.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    providers: [NotificationService],
    controllers: [NotificationController],
    exports: [NotificationService],
})
export class NotificationModule { }
