import { Module } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { SessionController } from '../Controllers/session.controller';
import { DatabaseModule } from '../Database/database.module';
import { NotificationModule } from './notification.module';
import { GoogleModule } from './google.module';

@Module({
    imports: [DatabaseModule, NotificationModule, GoogleModule],
    controllers: [SessionController],
    providers: [SessionService],
    exports: [SessionService],
})
export class SessionModule { }
