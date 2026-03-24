import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { DiscussionService } from '../Services/discussion.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateThreadDto, CreateReplyDto } from '../DTOs/discussion.dto';

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

    @Post()
    createThread(@Req() req: any, @Body() dto: CreateThreadDto) {
        return this.discussionService.createThread(req.user.id, dto);
    }

    @Post(':id/replies')
    createReply(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateReplyDto) {
        return this.discussionService.createReply(req.user.id, id, dto);
    }

    @Post(':id/like')
    toggleThreadLike(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.discussionService.toggleThreadLike(req.user.id, id);
    }

    @Post('replies/:id/like')
    toggleReplyLike(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.discussionService.toggleReplyLike(req.user.id, id);
    }

    @Patch(':id/resolve')
    resolveThread(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.discussionService.resolveThread(req.user.id, req.user.userType, id);
    }

    @Patch('replies/:id/mark-answer')
    markReplyAsAnswer(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.discussionService.markReplyAsAnswer(req.user.id, req.user.userType, id);
    }
}
