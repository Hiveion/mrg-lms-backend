import { Module } from '@nestjs/common';
import { SubjectService } from '../Services/subject.service';
import { SubjectController } from '../Controllers/subject.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [SubjectController],
    providers: [SubjectService],
    exports: [SubjectService],
})
export class SubjectModule { }
