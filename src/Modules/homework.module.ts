import { Module } from '@nestjs/common';
import { HomeworkService } from '../Services/homework.service';
import { HomeworkController } from '../Controllers/homework.controller';
import { DatabaseModule } from '../Database/database.module';
import { GoogleModule } from './google.module';

@Module({
    imports: [DatabaseModule, GoogleModule],
    controllers: [HomeworkController],
    providers: [HomeworkService],
    exports: [HomeworkService],
})
export class HomeworkModule { }
