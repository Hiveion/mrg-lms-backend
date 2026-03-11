import { Module } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { SessionController } from '../Controllers/session.controller';
import { DatabaseModule } from '../Database/database.module';
import { NotificationModule } from './notification.module';

@Module({
    imports: [DatabaseModule, NotificationModule],
    controllers: [SessionController],
    providers: [SessionService],
    exports: [SessionService],
})
export class SessionModule { }
