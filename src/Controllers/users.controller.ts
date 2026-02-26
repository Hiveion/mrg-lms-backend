import { Controller, Get } from '@nestjs/common';
import { UsersService } from '../Services/users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('tutors')
    findAllTutors() {
        return this.usersService.findAllTutors();
    }
}
