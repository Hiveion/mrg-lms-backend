import { Module } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { SessionController } from '../Controllers/session.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [SessionController],
    providers: [SessionService],
    exports: [SessionService],
})
export class SessionModule { }
