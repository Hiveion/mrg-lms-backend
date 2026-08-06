import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { ClassService } from '../Services/class.service';
import { CreateClassDto, UpdateClassDto } from '../DTOs/class.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('classes')
export class ClassController {
    constructor(private readonly classService: ClassService) { }

    @Get('my-classes')
    @UseGuards(AuthGuard('jwt'))
    async findMyClasses(@Req() req: any) {
        if (req.user.userType === UserRole.STUDENT) {
            return this.classService.findMyClassesForStudent(
                req.user.id,
                req.user.userType,
                req.user.id
            );
        }
        return this.classService.findMyClasses(req.user.id, req.user.userType);
    }

    @Post()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    create(@Body() createClassDto: CreateClassDto) {
        return this.classService.create(createClassDto);
    }

    @Get()
    @UseGuards(AuthGuard('jwt'))
    findAll(@Req() req: any) {
        if (req.user.userType === UserRole.STUDENT) {
            return this.classService.findAllForStudent(req.user.id);
        }
        return this.classService.findAll();
    }

    @Get(':id')
    @UseGuards(AuthGuard('jwt'))
    async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
        if (req.user.userType === UserRole.STUDENT) {
            return this.classService.findOneForStudent(id, req.user.id);
        }
        return this.classService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    update(@Param('id', ParseIntPipe) id: number, @Body() updateClassDto: UpdateClassDto) {
        return this.classService.update(id, updateClassDto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.classService.remove(id);
    }
}
