import { Module } from '@nestjs/common';
import { DiscussionService } from '../Services/discussion.service';
import { DiscussionController } from '../Controllers/discussion.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [DiscussionController],
    providers: [DiscussionService],
    exports: [DiscussionService],
})
export class DiscussionModule { }
