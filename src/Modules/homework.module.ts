import { Module } from '@nestjs/common';
import { HomeworkService } from '../Services/homework.service';
import { HomeworkController } from '../Controllers/homework.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [HomeworkController],
    providers: [HomeworkService],
    exports: [HomeworkService],
})
export class HomeworkModule { }
