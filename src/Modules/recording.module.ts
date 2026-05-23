import { Module } from '@nestjs/common';
import { RecordingService } from '../Services/recording.service';
import { RecordingController } from '../Controllers/recording.controller';
import { DatabaseModule } from '../Database/database.module';
import { GoogleModule } from './google.module';   

@Module({
    imports: [DatabaseModule, GoogleModule],
    controllers: [RecordingController],
    providers: [RecordingService],
    exports: [RecordingService],
})
export class RecordingModule { }
