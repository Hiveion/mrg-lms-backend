import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { HomeworkService } from '../Services/homework.service';
import { CreateHomeworkDto } from '../DTOs/homework.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('homeworks')
export class HomeworkController {
    constructor(private readonly homeworkService: HomeworkService) { }

    @Post()
    create(@Body() createHomeworkDto: CreateHomeworkDto) {
        return this.homeworkService.create(createHomeworkDto);
    }

    @Get()
    findAll() {
        return this.homeworkService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.homeworkService.findOne(id);
    }

    @Get('class/:classId')
    findByClass(@Param('classId', ParseIntPipe) classId: number) {
        return this.homeworkService.findByClass(classId);
    }
}
