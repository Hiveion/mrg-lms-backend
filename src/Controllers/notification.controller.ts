import {
    Controller,
    Get,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from '../Services/notification.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    async getMyNotifications(@Request() req: any) {
        return this.notificationService.getNotifications(req.user.id);
    }

    @Patch(':id/read')
    async markAsRead(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.notificationService.markAsRead(id, req.user.id);
    }

    @Patch('read-all')
    async markAllAsRead(@Request() req: any) {
        return this.notificationService.markAllAsRead(req.user.id);
    }

    @Delete(':id')
    async deleteNotification(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.notificationService.deleteNotification(id, req.user.id);
    }
}
