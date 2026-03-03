import { Module } from '@nestjs/common';
import { SchedulingService } from '../Services/scheduling.service';
import { SchedulingController } from '../Controllers/scheduling.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [SchedulingController],
    providers: [SchedulingService],
    exports: [SchedulingService],
})
export class SchedulingModule { }
