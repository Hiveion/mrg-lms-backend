import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { EnrollmentService } from '../Services/enrollment.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto, UpdateAssignedPriceDto } from '../DTOs/enrollment.dto';
import { AuthGuard } from '@nestjs/passport';
import { ToggleRecordingAccessDto } from '../DTOs/enrollment.dto';
import { UserRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';


@Controller('enrollments')
export class EnrollmentController {
    constructor(private readonly enrollmentService: EnrollmentService) { }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-enrollments')
    findMyEnrollments(@Request() req: any) {
        // If student, convert prices to their currency
        if (req.user.userType === UserRole.STUDENT) {
            return this.enrollmentService.findByStudentUserIdForStudent(
                req.user.id,
                req.user.userType
            );
        }
        // For admins/coordinators/tutors, return without conversion
        return this.enrollmentService.findByStudentUserId(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('next-sessions')
    findNextSessions(@Request() req: any) {
        return this.enrollmentService.findNextSessions(req.user.id);
    }

    @Post()
    create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
        return this.enrollmentService.create(createEnrollmentDto);
    }

    @Get()
    findAll() {
        return this.enrollmentService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.enrollmentService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateEnrollmentDto: UpdateEnrollmentDto) {
        return this.enrollmentService.update(id, updateEnrollmentDto);
    }

    @Patch(':id/price')
    updatePrice(@Param('id', ParseIntPipe) id: number, @Body() updatePriceDto: UpdateAssignedPriceDto) {
        return this.enrollmentService.updateAssignedPrice(id, updatePriceDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.enrollmentService.remove(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch(':id/recording-access')
    async toggleRecordingAccess(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: ToggleRecordingAccessDto, 
        @Request() req: any,
    ) {
        if (req.user.userType !== UserRole.ADMIN && req.user.userType !== UserRole.COORDINATOR) {
            throw new ForbiddenException('Only admins can toggle recording access');
        }
        return this.enrollmentService.toggleRecordingAccess(id, body.enabled);
    }
}
