import { Injectable } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { NotificationType, UserRole } from '@prisma/client';

@Injectable()
export class NotificationService {
    constructor(private readonly prisma: PrismaService) { }

    async notifyAdmins(title: string, message: string, type: NotificationType) {
        const admins = await this.prisma.user.findMany({
            where: {
                userType: {
                    in: [UserRole.ADMIN, UserRole.COORDINATOR]
                }
            },
            select: { id: true }
        });

        const adminIds = admins.map(admin => admin.id);
        if (adminIds.length > 0) {
            return this.createManyNotifications(adminIds, title, message, type);
        }
    }

    async createNotification(userId: number, title: string, message: string, type: NotificationType) {
        return this.prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
            },
        });
    }

    async createManyNotifications(userIds: number[], title: string, message: string, type: NotificationType) {
        const data = userIds.map(userId => ({
            userId,
            title,
            message,
            type,
        }));

        return this.prisma.notification.createMany({
            data,
        });
    }

    async notifyAdmins(title: string, message: string, type: NotificationType) {
        const admins = await this.prisma.user.findMany({
            where: {
                userType: {
                    in: [UserRole.ADMIN, UserRole.COORDINATOR]
                }
            },
            select: { id: true }
        });

        const adminIds = admins.map(admin => admin.id);
        if (adminIds.length > 0) {
            return this.createManyNotifications(adminIds, title, message, type);
        }
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
