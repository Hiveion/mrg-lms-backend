import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { ClassService } from '../Services/class.service';
import { CreateClassDto, UpdateClassDto } from '../DTOs/class.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';

@Controller('classes')
export class ClassController {
    constructor(private readonly classService: ClassService) { }

    @Get('my-classes')
    @UseGuards(AuthGuard('jwt'))
    async findMyClasses(@Req() req: any) {
        // If student, convert fees to their currency
        if (req.user.userType === UserRole.STUDENT) {
            return this.classService.findMyClassesForStudent(
                req.user.id,
                req.user.userType,
                req.user.id
            );
        }
        // For admins/coordinators/tutors, return without conversion
        return this.classService.findMyClasses(req.user.id, req.user.userType);
    }

    @Post()
    create(@Body() createClassDto: CreateClassDto) {
        return this.classService.create(createClassDto);
    }

    @Get()
    findAll() {
        return this.classService.findAll();
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
