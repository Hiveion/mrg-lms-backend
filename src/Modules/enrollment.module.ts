import { Module } from '@nestjs/common';
import { EnrollmentService } from '../Services/enrollment.service';
import { EnrollmentController } from '../Controllers/enrollment.controller';
import { DatabaseModule } from '../Database/database.module';
import { ExchangeRateModule } from './exchange-rate.module';

@Module({
    imports: [DatabaseModule, ExchangeRateModule],
    controllers: [EnrollmentController],
    providers: [EnrollmentService],
    exports: [EnrollmentService],
})
export class EnrollmentModule { }
