import { Controller, Get, Param, ParseIntPipe, UseGuards, Request, ForbiddenException, Res, NotFoundException } from '@nestjs/common';
import { RecordingService } from '../Services/recording.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { GoogleService } from '../Services/google.service';
import { Response } from 'express';

@Controller('recordings')
export class RecordingController {
    constructor(
        private readonly recordingService: RecordingService,
        private readonly googleService: GoogleService,
    ) { }

    // Get all recordings (thumbnail list)
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

    // Get single recording details
    @UseGuards(AuthGuard('jwt'))
    @Get(':sessionId')
    async findOne(
        @Param('sessionId', ParseIntPipe) sessionId: number,
        @Request() req: any,
    ) {
        const hasAccess = await this.recordingService.authorizeAccess(sessionId, req.user.id, req.user.userType);
        if (!hasAccess) throw new ForbiddenException('You do not have access to this recording');
        return this.recordingService.findOne(sessionId);
    }

    // Stream video — original working version
    @UseGuards(AuthGuard('jwt'))
    @Get('stream/:sessionId')
    async streamRecording(
        @Param('sessionId', ParseIntPipe) sessionId: number,
        @Request() req: any,
        @Res() res: Response,
    ) {
        await this.googleService.streamRecording(sessionId, req.user, res, req);
    }

    // Manually trigger recording fetch — original working version
    @Get('fetch/:sessionId')
    async fetchRecording(
        @Param('sessionId', ParseIntPipe) sessionId: number,
    ) {
        const result = await this.googleService.fetchAndSaveRecording(sessionId);
        return { result };
    }

    // Manually trigger transcript fetch 
    @Get('fetch-transcript/:sessionId')
    async fetchTranscript(
        @Param('sessionId', ParseIntPipe) sessionId: number,
        @Request() req: any,
    ) {
        const result = await this.googleService.fetchAndSaveTranscript(sessionId);
        return { result };
    }

    // Get transcript content as plain text
    @UseGuards(AuthGuard('jwt'))
    @Get('transcript/:sessionId')
    async getTranscriptContent(
        @Param('sessionId', ParseIntPipe) sessionId: number,
        @Request() req: any,
    ) {
        const hasAccess = await this.recordingService.authorizeAccess(sessionId, req.user.id, req.user.userType);
        if (!hasAccess) throw new ForbiddenException('You do not have access to this transcript');
        const content = await this.googleService.getTranscriptContent(sessionId);
        if (!content) throw new NotFoundException('Transcript not available');
        return { content };
    }
}
