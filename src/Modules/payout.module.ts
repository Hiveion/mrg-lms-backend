import { Module } from '@nestjs/common';
import { PayoutService } from '../Services/payout.service';
import { PayoutController } from '../Controllers/payout.controller';
import { DatabaseModule } from '../Database/database.module';
import { GoogleModule } from './google.module';

@Module({
    imports: [DatabaseModule, GoogleModule],
    controllers: [PayoutController],
    providers: [PayoutService],
    exports: [PayoutService],
})
export class PayoutModule { }
