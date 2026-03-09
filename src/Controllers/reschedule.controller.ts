import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RescheduleService } from '../Services/reschedule.service';
import { CreateRescheduleRequestDto, RespondRescheduleRequestDto } from '../DTOs/reschedule.dto';

@Controller('reschedule')
@UseGuards(AuthGuard('jwt'))
export class RescheduleController {
    constructor(private readonly rescheduleService: RescheduleService) { }

    /* ── Student endpoints ──────────────────────────────────────────────── */

    /**
     * POST /reschedule/sessions/:sessionId
     * Student requests a reschedule for a specific session.
     */
    @Post('sessions/:sessionId')
    async createRequest(
        @Request() req: any,
        @Param('sessionId', ParseIntPipe) sessionId: number,
        @Body() dto: CreateRescheduleRequestDto,
    ) {
        return this.rescheduleService.createRequest(req.user.id, sessionId, dto);
    }

    /**
     * GET /reschedule/my-requests
     * Student views all their own reschedule requests.
     */
    @Get('my-requests')
    async getMyRequests(@Request() req: any) {
        return this.rescheduleService.getStudentRequests(req.user.id);
    }

    /**
     * DELETE /reschedule/requests/:id
     * Student cancels a pending request they raised.
     */
    @Delete('requests/:id')
    async cancelRequest(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.rescheduleService.cancelRequest(req.user.id, id);
    }

    /* ── Tutor endpoints ────────────────────────────────────────────────── */

    /**
     * GET /reschedule/tutor-requests
     * Tutor views all reschedule requests for their classes (all statuses).
     */
    @Get('tutor-requests')
    async getTutorRequests(@Request() req: any) {
        return this.rescheduleService.getTutorRequests(req.user.id);
    }

    /**
     * PATCH /reschedule/requests/:id/accept
     * Tutor accepts a reschedule request → session dateTime updated.
     */
    @Patch('requests/:id/accept')
    async acceptRequest(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: RespondRescheduleRequestDto,
    ) {
        return this.rescheduleService.acceptRequest(req.user.id, id, dto);
    }

    /**
     * PATCH /reschedule/requests/:id/decline
     * Tutor declines a reschedule request.
     */
    @Patch('requests/:id/decline')
    async declineRequest(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: RespondRescheduleRequestDto,
    ) {
        return this.rescheduleService.declineRequest(req.user.id, id, dto);
    }
}
