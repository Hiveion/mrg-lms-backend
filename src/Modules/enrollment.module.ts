import { Module } from '@nestjs/common';
import { EnrollmentService } from '../Services/enrollment.service';
import { EnrollmentController } from '../Controllers/enrollment.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [EnrollmentController],
    providers: [EnrollmentService],
    exports: [EnrollmentService],
})
export class EnrollmentModule { }
