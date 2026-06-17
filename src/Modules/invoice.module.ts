import { Module } from '@nestjs/common';
import { InvoiceService } from '../Services/invoice.service';
import { InvoiceController } from '../Controllers/invoice.controller';
import { DatabaseModule } from '../Database/database.module';
import { NotificationModule } from './notification.module';
import { ExchangeRateModule } from './exchange-rate.module';

@Module({
    imports: [DatabaseModule, NotificationModule, ExchangeRateModule],
    controllers: [InvoiceController],
    providers: [InvoiceService],
    exports: [InvoiceService],
})
export class InvoiceModule { }
