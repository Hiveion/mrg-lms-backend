import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { PayoutStatus, SessionStatus } from '@prisma/client';
import { GoogleService } from './google.service';

@Injectable()
export class PayoutService {
    constructor(
        private prisma: PrismaService,
        private googleService: GoogleService
    ) { }

    async findAll(month?: string) {
        return this.prisma.tutorPayout.findMany({
            where: month ? { month } : undefined,
            include: {
                tutor: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                timezone: true,
                            }
                        }
                    }
                },
                items: {
                    include: {
                        class: {
                            select: {
                                name: true,
                                tutorHourlyRate: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc',
            }
        });
    }

    async previewPayouts(month: string) {
        // Parse month
        const [year, monthStr] = month.split('-').map(Number);
        const startDate = new Date(year, monthStr - 1, 1);
        const endDate = new Date(year, monthStr, 1);

        // Fetch completed sessions in this month
        const completedSessions = await this.prisma.session.findMany({
            where: {
                status: SessionStatus.COMPLETED,
                dateTime: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            include: {
                class: {
                    include: {
                        tutor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                    }
                                }
                            }
                        }
                    }
                },
            },
        });

        if (completedSessions.length === 0) {
            return [];
        }

        // Group by tutorId, then classId
        const tutorMap = new Map<number, Map<number, { sessions: any[], classItem: any }>>();

        for (const session of completedSessions) {
            const tutorId = session.class.tutorId;
            const classId = session.classId;

            if (!tutorMap.has(tutorId)) {
                tutorMap.set(tutorId, new Map());
            }

            const classMap = tutorMap.get(tutorId)!;
            if (!classMap.has(classId)) {
                classMap.set(classId, { sessions: [], classItem: session.class });
            }

            classMap.get(classId)!.sessions.push(session);
        }

        // Fetch already generated payouts for this month to filter them out
        const existingPayouts = await this.prisma.tutorPayout.findMany({
            where: { month },
            select: { tutorId: true }
        });
        const existingTutorIds = new Set(existingPayouts.map(p => p.tutorId));

        const previews: any[] = [];

        for (const [tutorId, classMap] of tutorMap.entries()) {
            // If already generated, skip showing in preview
            if (existingTutorIds.has(tutorId)) {
                continue;
            }

            const items: any[] = [];
            let totalAmount = 0;
            let tutorInfo: any = null;

            for (const [classId, data] of classMap.entries()) {
                const totalMinutes = data.sessions.reduce((sum, s) => sum + s.duration, 0);
                const hoursCount = totalMinutes / 60.0;
                const hourlyRate = data.classItem.tutorHourlyRate || 0.0;
                const amount = hoursCount * hourlyRate;

                if (!tutorInfo && data.classItem.tutor) {
                    tutorInfo = data.classItem.tutor;
                }

                items.push({
                    classId,
                    className: data.classItem.name,
                    hourlyRate,
                    hoursCount,
                    amount,
                });

                totalAmount += amount;
            }

            previews.push({
                tutorId,
                tutorName: tutorInfo ? `${tutorInfo.user.firstName} ${tutorInfo.user.lastName}` : `Tutor #${tutorId}`,
                month,
                amount: totalAmount,
                status: 'PENDING',
                items,
            });
        }

        return previews;
    }

    async generatePayouts(month: string, tutorId?: number) {
        // Parse month
        const [year, monthStr] = month.split('-').map(Number);
        const startDate = new Date(year, monthStr - 1, 1);
        const endDate = new Date(year, monthStr, 1);

        // Fetch completed sessions in this month
        const completedSessions = await this.prisma.session.findMany({
            where: {
                status: SessionStatus.COMPLETED,
                dateTime: {
                    gte: startDate,
                    lt: endDate,
                },
                class: tutorId ? { tutorId } : undefined,
            },
            include: {
                class: true,
            },
        });

        if (completedSessions.length === 0) {
            return { message: 'No completed sessions found for payout generation.', count: 0 };
        }

        // Group by tutorId, then classId
        const tutorMap = new Map<number, Map<number, { sessions: any[], classItem: any }>>();

        for (const session of completedSessions) {
            const tutorId = session.class.tutorId;
            const classId = session.classId;

            if (!tutorMap.has(tutorId)) {
                tutorMap.set(tutorId, new Map());
            }

            const classMap = tutorMap.get(tutorId)!;
            if (!classMap.has(classId)) {
                classMap.set(classId, { sessions: [], classItem: session.class });
            }

            classMap.get(classId)!.sessions.push(session);
        }

        let generatedCount = 0;
        let skippedCount = 0;

        for (const [tutorId, classMap] of tutorMap.entries()) {
            // Check if payout already exists
            const existingPayout = await this.prisma.tutorPayout.findFirst({
                where: { tutorId, month },
            });

            if (existingPayout) {
                skippedCount++;
                continue;
            }

            const payoutItemsData: { classId: number, hoursCount: number, amount: number }[] = [];
            let totalAmount = 0;

            for (const [classId, data] of classMap.entries()) {
                const totalMinutes = data.sessions.reduce((sum, s) => sum + s.duration, 0);
                const hoursCount = totalMinutes / 60.0;
                const hourlyRate = data.classItem.tutorHourlyRate || 0.0;
                const amount = hoursCount * hourlyRate;

                payoutItemsData.push({
                    classId,
                    hoursCount,
                    amount,
                });

                totalAmount += amount;
            }

            // Create TutorPayout and its items in transaction
            await this.prisma.tutorPayout.create({
                data: {
                    tutorId,
                    month,
                    amount: totalAmount,
                    status: PayoutStatus.PENDING,
                    items: {
                        create: payoutItemsData.map(item => ({
                            classId: item.classId,
                            hoursCount: item.hoursCount,
                            amount: item.amount,
                        })),
                    },
                },
            });

            generatedCount++;
        }

        return {
            message: 'Tutor payout generation complete.',
            generated: generatedCount,
            skipped: skippedCount,
            month,
        };
    }

    async updateStatus(
        id: number,
        adminId: number,
        updateData: {
            status: PayoutStatus;
            transactionReference?: string;
            additionalAmount?: number;
            discount?: number;
            notes?: string;
            file?: any;
        }
    ) {
        console.log('=== PayoutService.updateStatus ===');
        console.log('updateData file:', updateData.file ? { originalname: updateData.file.originalname, size: updateData.file.size } : 'undefined');

        const payout = await this.prisma.tutorPayout.findUnique({
            where: { id },
        });

        if (!payout) {
            throw new NotFoundException(`Tutor payout with ID ${id} not found.`);
        }

        let slipUrl = payout.slipUrl;
        let slipFileId = payout.slipFileId;

        if (updateData.file) {
            const uploadResult = await this.googleService.uploadFile(adminId, updateData.file);
            console.log('uploadResult:', uploadResult);
            if (uploadResult) {
                slipUrl = uploadResult.webViewLink;
                slipFileId = uploadResult.fileId;
            }
        }

        return this.prisma.tutorPayout.update({
            where: { id },
            data: {
                status: updateData.status,
                transactionReference: updateData.transactionReference !== undefined ? updateData.transactionReference : undefined,
                additionalAmount: updateData.additionalAmount !== undefined ? updateData.additionalAmount : undefined,
                discount: updateData.discount !== undefined ? updateData.discount : undefined,
                notes: updateData.notes !== undefined ? updateData.notes : undefined,
                slipUrl,
                slipFileId,
            },
            include: {
                tutor: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            }
                        }
                    }
                },
                items: {
                    include: {
                        class: {
                            select: {
                                name: true,
                                tutorHourlyRate: true,
                            }
                        }
                    }
                }
            }
        });
    }
}
