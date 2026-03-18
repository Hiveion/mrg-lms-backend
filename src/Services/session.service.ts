import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateSessionDto, UpdateSessionDto } from '../DTOs/session.dto';
import { EnrollmentStatus, SessionStatus, NotificationType } from '@prisma/client';
import { NotificationService } from './notification.service';
import { GoogleService } from './google.service';

@Injectable()
export class SessionService {
    constructor(
        private prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly googleService: GoogleService
    ) { }

    async create(createSessionDto: CreateSessionDto, adminId?: number) {
        const classItem = await this.prisma.class.findUnique({
            where: { id: createSessionDto.classId },
            include: {
                tutor: { include: { user: true } },
                enrollments: {
                    where: { status: EnrollmentStatus.ACTIVE },
                    include: { student: { include: { user: true } } },
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
                NotificationType.CLASS
            );

            // Notify students
            const studentUserIds = classItem.enrollments.map(e => e.student.userId);
            if (studentUserIds.length > 0) {
                await this.notificationService.createManyNotifications(
                    studentUserIds,
                    title,
                    message,
                    NotificationType.CLASS
                );
            }
        } catch (error) {
            console.error('Failed to send session creation notifications:', error);
        }

        // Google Calendar
        if (adminId) {
            try {
                const studentEmails = classItem.enrollments.map(e => e.student.user.email);
                const tutorEmail = classItem.tutor.user.email;

                // Build a fully-enriched session payload so the GoogleService
                // can access session.class.name and session.class.subject.name
                const sessionPayload = {
                    ...session,
                    class: {
                        name: classItem.name,
                        subject: { name: classItem.subject.name },
                    },
                };

                await this.googleService.createCalendarEvent(
                    adminId,
                    sessionPayload,
                    studentEmails,
                    tutorEmail
                );
            } catch (error) {
                console.error('Failed to create calendar event:', error);
            }
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

    async update(id: number, updateSessionDto: UpdateSessionDto, adminId?: number) {
        const sessionExists = await this.prisma.session.findUnique({
            where: { id },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: { include: { user: true } },
                        enrollments: {
                            where: { status: EnrollmentStatus.ACTIVE },
                            include: { student: { include: { user: true } } },
                        },
                    },
                },
            },
        });
        if (!sessionExists) {
            throw new NotFoundException(`Session with ID ${id} not found`);
        }

        const updatedSession = await this.prisma.session.update({
            where: { id },
            data: {
                ...updateSessionDto,
                dateTime: updateSessionDto.dateTime ? new Date(updateSessionDto.dateTime) : undefined,
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: { include: { user: true } },
                    },
                },
            },
        });

        if (adminId) {
            try {
                const studentEmails = sessionExists.class.enrollments.map(e => e.student.user.email);
                const tutorEmail = sessionExists.class.tutor.user.email;
                await this.googleService.updateCalendarEvent(
                    adminId,
                    updatedSession,
                    studentEmails,
                    tutorEmail
                );
            } catch (error) {
                console.error('Failed to update calendar event:', error);
            }
        }

        return updatedSession;
    }

    async remove(id: number, adminId?: number) {
        try {
            const session = await this.prisma.session.findUnique({
                where: { id },
                select: { googleEventId: true },
            });

            if (adminId && session?.googleEventId) {
                await this.googleService.deleteCalendarEvent(adminId, session.googleEventId);
            }

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
