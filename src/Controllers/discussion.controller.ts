import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { DiscussionService } from '../Services/discussion.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('discussions')
@UseGuards(AuthGuard('jwt'))
export class DiscussionController {
    constructor(private readonly discussionService: DiscussionService) { }

    @Get()
    findAll(
        @Query('classId') classId?: string,
        @Query('type') type?: string,
        @Query('search') search?: string,
    ) {
        return this.discussionService.findAll({ classId, type, search });
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.discussionService.findOne(id);
    }
}
