import { Module } from '@nestjs/common';
import { PayoutService } from '../Services/payout.service';
import { PayoutController } from '../Controllers/payout.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [PayoutController],
    providers: [PayoutService],
    exports: [PayoutService],
})
export class PayoutModule { }
