import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateSessionDto, UpdateSessionDto, CreateSessionFeedbackDto } from '../DTOs/session.dto';
import { RequestExtraClassDto } from '../DTOs/extra-class-request.dto';
import { EnrollmentStatus, SessionStatus, NotificationType, UserRole, SessionType } from '@prisma/client';
import { NotificationService } from './notification.service';
import { GoogleService } from './google.service';

@Injectable()
export class SessionService {
    constructor(
        private prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly googleService: GoogleService
    ) { }

    async create(createSessionDto: CreateSessionDto, userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

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

        // Access control: Only Admin, Coordinator, or the assigned Tutor can schedule
        if (user.userType === UserRole.TUTOR && classItem.tutor.userId !== userId) {
            throw new BadRequestException('Tutors can only schedule sessions for their own classes');
        }

        const session = await this.prisma.session.create({
            data: {
                ...createSessionDto,
                dateTime: new Date(createSessionDto.dateTime),
                extraClassRate: createSessionDto.type === SessionType.EXTRA ? createSessionDto.extraClassRate : null,
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

            // Notify tutor (if scheduled by admin/coordinator)
            if (classItem.tutor.userId !== userId) {
                await this.notificationService.createNotification(
                    classItem.tutor.userId,
                    title,
                    message,
                    NotificationType.CLASS
                );
            }

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
        // Only if scheduled by Admin or Coordinator (who have google tokens set up usually) or if we want to support tutor's calendar too.
        // For now, keeping the adminId check logic if it refers to the person who has the calendar linked.
        if (user.userType === UserRole.ADMIN || user.userType === UserRole.COORDINATOR) {
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
                    userId,
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

        const sessionType = updateSessionDto.type || sessionExists.type;
        const extraClassRate = sessionType === SessionType.EXTRA ? updateSessionDto.extraClassRate : null;

        const updatedSession = await this.prisma.session.update({
            where: { id },
            data: {
                ...updateSessionDto,
                dateTime: updateSessionDto.dateTime ? new Date(updateSessionDto.dateTime) : undefined,
                extraClassRate,
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

    async findAllExtraClassRequests() {
        return this.prisma.session.findMany({
            where: {
                type: SessionType.EXTRA,
                status: SessionStatus.PENDING,
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: {
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
                createdAt: 'desc',
            },
        });
    }

    async requestExtraClass(requestDto: RequestExtraClassDto, userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        if (user.userType !== UserRole.TUTOR) {
            throw new BadRequestException('Only tutors can request extra classes');
        }

        const classItem = await this.prisma.class.findUnique({
            where: { id: requestDto.classId },
            include: {
                tutor: true,
                subject: true,
            },
        });

        if (!classItem) {
            throw new NotFoundException(`Class with ID ${requestDto.classId} not found`);
        }

        // Verify the tutor owns this class
        if (classItem.tutor.userId !== userId) {
            throw new BadRequestException('Tutors can only request extra classes for their own classes');
        }

        // Create a session with PENDING status and EXTRA type
        const extraSession = await this.prisma.session.create({
            data: {
                classId: requestDto.classId,
                dateTime: new Date(requestDto.dateTime),
                duration: requestDto.duration,
                status: SessionStatus.PENDING,
                type: SessionType.EXTRA,
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

        // Send notification to all admins
        try {
            const dateTimeStr = new Date(extraSession.dateTime).toLocaleString();
            const tutorName = `${user.firstName} ${user.lastName}`;
            const title = 'Extra Class Request';
            const message = `${tutorName} has requested an extra class for ${classItem.subject.name} - ${classItem.name} on ${dateTimeStr}. ${requestDto.reason ? `Reason: ${requestDto.reason}` : ''}`;

            const admins = await this.prisma.user.findMany({
                where: { userType: UserRole.ADMIN },
                select: { id: true },
            });

            const adminIds = admins.map(a => a.id);
            if (adminIds.length > 0) {
                await this.notificationService.createManyNotifications(
                    adminIds,
                    title,
                    message,
                    NotificationType.CLASS
                );
            }
        } catch (error) {
            console.error('Failed to send extra class request notifications:', error);
        }

        return extraSession;
    }

    async approveExtraClass(sessionId: number, rate: number, link?: string, adminUserId?: number) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
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

        if (!session) {
            throw new NotFoundException(`Session with ID ${sessionId} not found`);
        }

        if (session.type !== SessionType.EXTRA || session.status !== SessionStatus.PENDING) {
            throw new BadRequestException('This session is not a pending extra class request');
        }

        const updatedSession = await this.prisma.session.update({
            where: { id: sessionId },
            data: {
                status: SessionStatus.SCHEDULED,
                extraClassRate: rate,
                link: link || undefined,
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

        // Notify tutor
        try {
            const dateTimeStr = new Date(session.dateTime).toLocaleString();
            await this.notificationService.createNotification(
                session.class.tutor.userId,
                'Extra Class Approved',
                `Your extra class request for ${session.class.subject.name} - ${session.class.name} on ${dateTimeStr} has been approved. Rate: ${rate}`,
                NotificationType.CLASS
            );

            // Notify students
            const studentUserIds = session.class.enrollments.map(e => e.student.userId);
            if (studentUserIds.length > 0) {
                await this.notificationService.createManyNotifications(
                    studentUserIds,
                    'Extra Class Scheduled',
                    `An extra class for ${session.class.subject.name} - ${session.class.name} has been scheduled for ${dateTimeStr}.`,
                    NotificationType.CLASS
                );
            }
        } catch (error) {
            console.error('Failed to send extra class approval notifications:', error);
        }

        return updatedSession;
    }

    async declineExtraClass(sessionId: number, reason?: string) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: { include: { user: true } },
                    },
                },
            },
        });

        if (!session) {
            throw new NotFoundException(`Session with ID ${sessionId} not found`);
        }

        if (session.type !== SessionType.EXTRA || session.status !== SessionStatus.PENDING) {
            throw new BadRequestException('This session is not a pending extra class request');
        }

        const updatedSession = await this.prisma.session.update({
            where: { id: sessionId },
            data: {
                status: SessionStatus.CANCELLED,
                cancellationReason: reason || 'Extra class request declined by admin',
            },
        });

        // Notify tutor
        try {
            const dateTimeStr = new Date(session.dateTime).toLocaleString();
            await this.notificationService.createNotification(
                session.class.tutor.userId,
                'Extra Class Declined',
                `Your extra class request for ${session.class.subject.name} - ${session.class.name} on ${dateTimeStr} has been declined.${reason ? ` Reason: ${reason}` : ''}`,
                NotificationType.CLASS
            );
        } catch (error) {
            console.error('Failed to send extra class decline notification:', error);
        }

        return updatedSession;
    }

    async createFeedback(sessionId: number, studentId: number, userId: number, feedbackDto: CreateSessionFeedbackDto) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: { class: { include: { tutor: true } } }
        });

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        const tutor = session.class.tutor;
        if (tutor.userId !== userId) {
            throw new BadRequestException('Only the tutor of this class can leave feedback');
        }

        const student = await this.prisma.student.findUnique({
            where: { id: studentId }
        });

        if (!student) {
            throw new NotFoundException('Student not found');
        }

        const existingFeedback = await this.prisma.sessionFeedback.findUnique({
            where: {
                sessionId_studentId: {
                    sessionId,
                    studentId
                }
            }
        });

        if (existingFeedback) {
            throw new BadRequestException('Feedback already exists for this student in this session');
        }

        // Create the feedback
        const feedback = await this.prisma.sessionFeedback.create({
            data: {
                sessionId,
                studentId,
                tutorId: tutor.id,
                rating: feedbackDto.rating,
                note: feedbackDto.note
            }
        });

        // Calculate new average rating for the student
        const allFeedbacks = await this.prisma.sessionFeedback.findMany({
            where: { studentId }
        });

        const totalRating = allFeedbacks.reduce((sum, f) => sum + f.rating, 0);
        const averageRating = allFeedbacks.length > 0 ? (totalRating / allFeedbacks.length) : 0;

        await this.prisma.student.update({
            where: { id: studentId },
            data: { rating: averageRating }
        });

        // Set the session status to COMPLETED if not already
        if (session.status !== SessionStatus.COMPLETED) {
            await this.prisma.session.update({
                where: { id: sessionId },
                data: { status: SessionStatus.COMPLETED }
            });
        }

        return feedback;
    }

}
