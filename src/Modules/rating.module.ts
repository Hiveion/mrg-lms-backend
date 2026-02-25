import { Module } from '@nestjs/common';
import { RatingController } from '../Controllers/rating.controller';
import { RatingService } from '../Services/rating.service';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [RatingController],
    providers: [RatingService],
    exports: [RatingService],
})
export class RatingModule { }
