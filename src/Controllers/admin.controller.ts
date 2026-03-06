import { Controller, Post, Get, Body, UseGuards, Request, Param, ParseIntPipe } from '@nestjs/common';
import { AdminService } from '../Services/admin.service';
import { CreateUserByAdminDto, InviteUserDto } from '../DTOs/admin.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    async getUsers() {
        return this.adminService.findAllUsers();
    }

    @Post('invite-user')
    async inviteUser(@Body() inviteUserDto: InviteUserDto) {
        return this.adminService.inviteUser(inviteUserDto);
    }

    @Post('create-user')
    async createUser(@Body() createUserByAdminDto: CreateUserByAdminDto) {
        return this.adminService.createUserByAdmin(createUserByAdminDto);
    }

    @Post('approve-user/:id')
    async approveUser(@Param('id', ParseIntPipe) id: number) {
        return this.adminService.approveUser(id);
    }

    @Post('reject-user/:id')
    async rejectUser(@Param('id', ParseIntPipe) id: number, @Body('reason') reason?: string) {
        return this.adminService.rejectUser(id, reason);
    }
}
