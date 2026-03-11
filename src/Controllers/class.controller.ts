import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ClassService } from '../Services/class.service';
import { CreateClassDto, UpdateClassDto } from '../DTOs/class.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('classes')
@UseGuards(AuthGuard('jwt'))
export class ClassController {
    constructor(private readonly classService: ClassService) { }

    @Post()
    create(@Body() createClassDto: CreateClassDto) {
        return this.classService.create(createClassDto);
    }

    @Get()
    findAll() {
        return this.classService.findAll();
    }

    @Get('tutor')
    findTutorClasses(@Request() req: any) {
        return this.classService.findTutorClasses(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.classService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateClassDto: UpdateClassDto) {
        return this.classService.update(id, updateClassDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.classService.remove(id);
    }
}
