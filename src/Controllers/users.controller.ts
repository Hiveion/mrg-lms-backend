import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../Services/users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-students')
    findMyStudents(@Request() req: any) {
        return this.usersService.findMyStudents(req.user.id);
    }

    @Get('tutors')
    findAllTutors() {
        return this.usersService.findAllTutors();
    }

    @Get('students')
    findAllStudents() {
        return this.usersService.findAllStudents();
    }
}
