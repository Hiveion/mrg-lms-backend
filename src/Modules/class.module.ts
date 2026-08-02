import { Module } from '@nestjs/common';
import { ClassService } from '../Services/class.service';
import { ClassController } from '../Controllers/class.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [ClassController],
    providers: [ClassService],
    exports: [ClassService],
})
export class ClassModule { }
