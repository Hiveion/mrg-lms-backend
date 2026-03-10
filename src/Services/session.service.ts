import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateSessionDto, UpdateSessionDto } from '../DTOs/session.dto';
import { EnrollmentStatus, SessionStatus, NotificationType } from '@prisma/client';
import { NotificationService } from './notification.service';

@Injectable()
export class SessionService {
    constructor(private prisma: PrismaService, private readonly notificationService: NotificationService) { }

    async create(createSessionDto: CreateSessionDto) {
        const classItem = await this.prisma.class.findUnique({
            where: { id: createSessionDto.classId },
            include: {
                tutor: { select: { userId: true } },
                enrollments: {
                    where: { status: EnrollmentStatus.ACTIVE },
                    include: { student: { select: { userId: true } } },
                },
                subject: true,
            },
        });
        if (!classItem) {
            throw new NotFoundException(`Class with ID ${createSessionDto.classId} not found`);
        }

        const session = await this.prisma.session.create({
            data: {
                ...createSessionDto,
                dateTime: new Date(createSessionDto.dateTime),
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        profilePicture: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Notifications
        try {
            const dateTimeStr = new Date(session.dateTime).toLocaleString();
            const title = `New Session Scheduled`;
            const message = `A new session for ${classItem.subject.name} - ${classItem.name} has been scheduled for ${dateTimeStr}.`;

            // Notify tutor
            await this.notificationService.createNotification(
                classItem.tutor.userId,
                title,
                message,
                NotificationType.CLASS,
                '/dashboard/schedule'
            );

            // Notify students
            const studentUserIds = classItem.enrollments.map(e => e.student.userId);
            if (studentUserIds.length > 0) {
                await this.notificationService.createManyNotifications(
                    studentUserIds,
                    title,
                    message,
                    NotificationType.CLASS,
                    '/dashboard/schedule'
                );
            }
        } catch (error) {
            console.error('Failed to send session creation notifications:', error);
        }

        return session;
    }

    async findAll() {
        return this.prisma.session.findMany({
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        profilePicture: true,
                                    },
                                },
                            },
                        },
                    },
                },
                rescheduleRequests: {
                    where: { status: 'PENDING' },
                    include: {
                        student: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                    },
                                },
                            },
                        },
                    },
                },
                rescheduledSession: {
                    select: {
                        id: true,
                        dateTime: true,
                        status: true,
                        link: true,
                    },
                },
            },
            orderBy: {
                dateTime: 'desc',
            },
        });
    }

    async findOne(id: number) {
        const session = await this.prisma.session.findUnique({
            where: { id },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        profilePicture: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!session) {
            throw new NotFoundException(`Session with ID ${id} not found`);
        }

        return session;
    }

    async update(id: number, updateSessionDto: UpdateSessionDto) {
        const sessionExists = await this.prisma.session.findUnique({
            where: { id },
        });
        if (!sessionExists) {
            throw new NotFoundException(`Session with ID ${id} not found`);
        }

        return this.prisma.session.update({
            where: { id },
            data: {
                ...updateSessionDto,
                dateTime: updateSessionDto.dateTime ? new Date(updateSessionDto.dateTime) : undefined,
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        profilePicture: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    async remove(id: number) {
        try {
            return await this.prisma.session.delete({
                where: { id },
            });
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Session with ID ${id} not found`);
            }
            throw error;
        }
    }

    async findByStudentUserId(userId: number) {
        return this.prisma.session.findMany({
            where: {
                class: {
                    enrollments: {
                        some: {
                            student: {
                                userId: userId,
                            },
                            status: EnrollmentStatus.ACTIVE,
                        },
                    },
                },
            },
            include: {
                rescheduledSession: true,
                rescheduleRequests: {
                    where: { status: 'PENDING' },
                    include: {
                        student: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                            },
                        },
                    },
                },
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        profilePicture: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                dateTime: 'asc',
            },
        });
    }

    async findByTutorUserId(userId: number) {
        return this.prisma.session.findMany({
            where: {
                class: {
                    tutor: {
                        userId: userId,
                    },
                },
            },
            include: {
                rescheduledSession: true,
                rescheduleRequests: {
                    where: { status: 'PENDING' },
                    include: {
                        student: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                            },
                        },
                    },
                },
                class: {
                    include: {
                        subject: true,
                    },
                },
            },
            orderBy: {
                dateTime: 'asc',
            },
        });
    }
}
