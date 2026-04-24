import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { CreateSessionDto, UpdateSessionDto } from '../DTOs/session.dto';
import { RequestExtraClassDto } from '../DTOs/extra-class-request.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('sessions')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }

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
