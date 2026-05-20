import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { CreateSessionDto, UpdateSessionDto, CreateSessionFeedbackDto } from '../DTOs/session.dto';
import { RequestExtraClassDto } from '../DTOs/extra-class-request.dto';
import { ApproveExtraClassDto, DeclineExtraClassDto } from '../DTOs/approve-extra-class.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('sessions')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }

    @UseGuards(AuthGuard('jwt'))
    @Post(':id/student/:studentId/feedback')
    createFeedback(
        @Param('id', ParseIntPipe) id: number,
        @Param('studentId', ParseIntPipe) studentId: number,
        @Request() req: any,
        @Body() createFeedbackDto: CreateSessionFeedbackDto
    ) {
        return this.sessionService.createFeedback(id, studentId, req.user.id, createFeedbackDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-sessions')
    findMySessions(@Request() req: any) {
        return this.sessionService.findByStudentUserId(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('tutor-sessions')
    findTutorSessions(@Request() req: any) {
        return this.sessionService.findByTutorUserId(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post()
    create(@Request() req: any, @Body() createSessionDto: CreateSessionDto) {
        return this.sessionService.create(createSessionDto, req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('request-extra-class')
    requestExtraClass(@Request() req: any, @Body() requestDto: RequestExtraClassDto) {
        return this.sessionService.requestExtraClass(requestDto, req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get()
    findAll() {
        return this.sessionService.findAll();
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('extra-class-requests')
    findAllExtraClassRequests() {
        return this.sessionService.findAllExtraClassRequests();
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch('extra-class-requests/:id/approve')
    approveExtraClass(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ApproveExtraClassDto,
    ) {
        return this.sessionService.approveExtraClass(id, dto.rate, dto.link, req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch('extra-class-requests/:id/decline')
    declineExtraClass(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: DeclineExtraClassDto,
    ) {
        return this.sessionService.declineExtraClass(id, dto.reason);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.sessionService.findOne(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch(':id')
    update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() updateSessionDto: UpdateSessionDto) {
        return this.sessionService.update(id, updateSessionDto, req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Delete(':id')
    remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.sessionService.remove(id, req.user.id);
    }
}
