import { Injectable } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationService {
    constructor(private readonly prisma: PrismaService) { }

    async createNotification(userId: number, title: string, message: string, type: NotificationType, link?: string) {
        return this.prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link,
            },
        });
    }

    async createManyNotifications(userIds: number[], title: string, message: string, type: NotificationType, link?: string) {
        const data = userIds.map(userId => ({
            userId,
            title,
            message,
            type,
            link,
        }));

        return this.prisma.notification.createMany({
            data,
        });
    }

    async getNotifications(userId: number) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async markAsRead(notificationId: number, userId: number) {
        return this.prisma.notification.update({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: number) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    async deleteNotification(notificationId: number, userId: number) {
        return this.prisma.notification.delete({
            where: { id: notificationId, userId },
        });
    }
}
