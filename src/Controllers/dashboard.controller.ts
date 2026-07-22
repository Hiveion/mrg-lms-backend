import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../Guards/roles.guard';
import { Roles } from '../Decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DashboardService } from '../Services/dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('admin')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
    async getAdminDashboardStats() {
        return this.dashboardService.getAdminStats();
    }

    @Get('tutor')
    @UseGuards(RolesGuard)
    @Roles(UserRole.TUTOR)
    async getTutorDashboardStats(@Request() req: any) {
        return this.dashboardService.getTutorStats(req.user.id);
    }

    @Get('student')
    @UseGuards(RolesGuard)
    @Roles(UserRole.STUDENT)
    async getStudentDashboardStats(@Request() req: any) {
        return this.dashboardService.getStudentStats(req.user.id);
    }
}
