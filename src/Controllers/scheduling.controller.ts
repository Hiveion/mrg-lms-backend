import { Controller, Post, Body, Get, UseGuards, Request, Param, ParseIntPipe, Patch, Delete } from '@nestjs/common';
import { SchedulingService } from '../Services/scheduling.service';
import { SetAvailabilityDto, UpdateAvailabilitySlotDto } from '../DTOs/scheduling.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('scheduling')
export class SchedulingController {
    constructor(private readonly schedulingService: SchedulingService) { }

    @UseGuards(AuthGuard('jwt'))
    @Post('tutor/availability')
    async setTutorAvailability(@Request() req: any, @Body() dto: SetAvailabilityDto) {
        return this.schedulingService.setTutorAvailability(req.user.id, dto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch('tutor/availability/:id')
    async updateTutorAvailabilitySlot(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAvailabilitySlotDto,
    ) {
        return this.schedulingService.updateTutorAvailabilitySlot(req.user.id, id, dto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Delete('tutor/availability/:id')
    async deleteTutorAvailabilitySlot(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.schedulingService.deleteTutorAvailabilitySlot(req.user.id, id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('student/availability')
    async setStudentAvailability(@Request() req: any, @Body() dto: SetAvailabilityDto) {
        return this.schedulingService.setStudentAvailability(req.user.id, dto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch('student/availability/:id')
    async updateStudentAvailabilitySlot(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAvailabilitySlotDto,
    ) {
        return this.schedulingService.updateStudentAvailabilitySlot(req.user.id, id, dto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Delete('student/availability/:id')
    async deleteStudentAvailabilitySlot(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.schedulingService.deleteStudentAvailabilitySlot(req.user.id, id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('tutor/availability')
    async getTutorAvailability(@Request() req: any) {
        return this.schedulingService.getTutorAvailability(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('student/availability')
    async getStudentAvailability(@Request() req: any) {
        return this.schedulingService.getStudentAvailability(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('match/:studentId/:tutorId')
    async matchAvailability(
        @Param('studentId', ParseIntPipe) studentId: number,
        @Param('tutorId', ParseIntPipe) tutorId: number,
    ) {
        // tutorId/studentId here are the internal profile IDs, can also be modified to take user IDs.
        return this.schedulingService.findOverlaps(tutorId, studentId);
    }
}
