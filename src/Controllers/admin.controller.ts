import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AdminService } from '../Services/admin.service';
import { CreateUserByAdminDto, InviteUserDto, AssignClassDto } from '../DTOs/admin.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Post('invite-user')
    async inviteUser(@Body() inviteUserDto: InviteUserDto) {
        return this.adminService.inviteUser(inviteUserDto);
    }

    @Post('create-user')
    async createUser(@Body() createUserByAdminDto: CreateUserByAdminDto) {
        return this.adminService.createUserByAdmin(createUserByAdminDto);
    }

    @Post('assign-class')
    async assignClass(@Body() assignClassDto: AssignClassDto) {
        return this.adminService.assignClass(assignClassDto);
    }
}
