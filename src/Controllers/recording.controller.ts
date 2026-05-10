import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request, ForbiddenException, Res } from '@nestjs/common';
import { RecordingService } from '../Services/recording.service';
import { CreateRecordingDto, UpdateRecordingDto } from '../DTOs/recording.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { GoogleService } from '../Services/google.service';  
import { Response } from 'express';


@Controller('recordings')
export class RecordingController {
    constructor(
        private readonly recordingService: RecordingService,
        private readonly googleService: GoogleService
    ) { }

    @UseGuards(AuthGuard('jwt'))
    @Post()
    async create(@Request() req: any, @Body() createRecordingDto: CreateRecordingDto) {
        if (req.user.userType !== UserRole.ADMIN && req.user.userType !== UserRole.COORDINATOR && req.user.userType !== UserRole.TUTOR) {
            throw new ForbiddenException('Only administrators and tutors can create recordings');
        }
        return this.recordingService.create(createRecordingDto, req.user.id, req.user.userType);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('metadata')
    async getMetadata(@Request() req: any) {
        return this.recordingService.getRecordingMetadata(req.user.id, req.user.userType);
    }

    //test recording fetching
    @Get('test-recording/:sessionId')
    async testRecording(@Param('sessionId', ParseIntPipe) sessionId: number) {
        const result = await this.googleService.fetchAndSaveRecording(sessionId);
        return { result };
    }

    //streaming

    @UseGuards(AuthGuard('jwt'))
    @Get('stream/:sessionId')
    async streamRecording(
        @Param('sessionId', ParseIntPipe) sessionId: number,
        @Request() req: any,
        @Res() res: Response,
    ) {
        await this.googleService.streamRecording(sessionId, req.user, res);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get()
    async findAll(@Request() req: any) {
        if (req.user.userType === UserRole.ADMIN || req.user.userType === UserRole.COORDINATOR) {
            return this.recordingService.findAll();
        } else if (req.user.userType === UserRole.TUTOR) {
            return this.recordingService.findByTutor(req.user.id);
        } else if (req.user.userType === UserRole.STUDENT) {
            return this.recordingService.findByStudent(req.user.id);
        }
        return [];
    }

    @UseGuards(AuthGuard('jwt'))
    @Get(':id')
    async findOne(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        const hasAccess = await this.recordingService.authorizeRecordingAccess(id, req.user.id, req.user.userType);
        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this recording');
        }
        return this.recordingService.findOne(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Patch(':id')
    async update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() updateRecordingDto: UpdateRecordingDto) {
        if (req.user.userType !== UserRole.ADMIN && req.user.userType !== UserRole.COORDINATOR) {
            throw new ForbiddenException('Only administrators can update recordings');
        }
        return this.recordingService.update(id, updateRecordingDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Delete(':id')
    async remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        const hasAccess = await this.recordingService.authorizeRecordingAccess(id, req.user.id, req.user.userType);
        if (!hasAccess || (req.user.userType !== UserRole.ADMIN && req.user.userType !== UserRole.COORDINATOR && req.user.userType !== UserRole.TUTOR)) {
            throw new ForbiddenException('You do not have permission to delete this recording');
        }
        return this.recordingService.remove(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post(':id/view')
    async incrementViewCount(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        const hasAccess = await this.recordingService.authorizeRecordingAccess(id, req.user.id, req.user.userType);
        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this recording');
        }
        return this.recordingService.incrementViewCount(id);
    }
}
