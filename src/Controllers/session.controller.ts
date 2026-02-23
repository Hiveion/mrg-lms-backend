import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { SessionService } from '../Services/session.service';
import { CreateSessionDto, UpdateSessionDto } from '../DTOs/session.dto';

@Controller('sessions')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }

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
