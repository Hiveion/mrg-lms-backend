import { Module } from '@nestjs/common';
import { ClassService } from '../Services/class.service';
import { ClassController } from '../Controllers/class.controller';
import { DatabaseModule } from '../Database/database.module';
import { ExchangeRateModule } from './exchange-rate.module';

@Module({
    imports: [DatabaseModule, ExchangeRateModule],
    controllers: [ClassController],
    providers: [ClassService],
    exports: [ClassService],
})
export class ClassModule { }
