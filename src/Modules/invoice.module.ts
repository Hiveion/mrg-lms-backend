import { Module } from '@nestjs/common';
import { InvoiceService } from '../Services/invoice.service';
import { InvoiceController } from '../Controllers/invoice.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [InvoiceController],
    providers: [InvoiceService],
    exports: [InvoiceService],
})
export class InvoiceModule { }
