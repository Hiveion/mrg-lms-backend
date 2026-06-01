import { Module } from '@nestjs/common';
import { ExchangeRateService } from '../Services/exchange-rate.service';

@Module({
    providers: [ExchangeRateService],
    exports: [ExchangeRateService],
})
export class ExchangeRateModule { }
