import { Module } from '@nestjs/common';
import { RecordingService } from '../Services/recording.service';
import { RecordingController } from '../Controllers/recording.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [RecordingController],
    providers: [RecordingService],
    exports: [RecordingService],
})
export class RecordingModule { }
