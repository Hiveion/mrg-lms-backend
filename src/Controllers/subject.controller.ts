import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SubjectService } from '../Services/subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from '../DTOs/subject.dto';

@Controller('subjects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SubjectController {
    constructor(private readonly subjectService: SubjectService) { }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    create(@Body() createSubjectDto: CreateSubjectDto) {
        return this.subjectService.create(createSubjectDto);
    }

    @Get()
    findAll() {
        return this.subjectService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.subjectService.findOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    update(@Param('id', ParseIntPipe) id: number, @Body() updateSubjectDto: UpdateSubjectDto) {
        return this.subjectService.update(id, updateSubjectDto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.subjectService.remove(id);
    }
}
