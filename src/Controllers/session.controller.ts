import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { CreateSessionDto, UpdateSessionDto } from '../DTOs/session.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('sessions')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-sessions')
    findMySessions(@Request() req: any) {
        return this.sessionService.findByStudentUserId(req.user.id);
    }

    @Post()
    create(@Body() createSessionDto: CreateSessionDto) {
        return this.sessionService.create(createSessionDto);
    }

    @Get()
    findAll() {
        return this.sessionService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.sessionService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateSessionDto: UpdateSessionDto) {
        return this.sessionService.update(id, updateSessionDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.sessionService.remove(id);
    }
}
