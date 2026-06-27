import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { PayoutStatus, SessionStatus } from '@prisma/client';

@Injectable()
export class PayoutService {
    constructor(private prisma: PrismaService) { }

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

    async generatePayouts(month: string) {
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

    async updateStatus(id: number, status: PayoutStatus, transactionReference?: string) {
        const payout = await this.prisma.tutorPayout.findUnique({
            where: { id },
        });

        if (!payout) {
            throw new NotFoundException(`Tutor payout with ID ${id} not found.`);
        }

        return this.prisma.tutorPayout.update({
            where: { id },
            data: {
                status,
                transactionReference: transactionReference !== undefined ? transactionReference : undefined,
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
