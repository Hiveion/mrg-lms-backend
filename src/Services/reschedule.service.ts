import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateRescheduleRequestDto, RespondRescheduleRequestDto } from '../DTOs/reschedule.dto';
import { NotificationService } from './notification.service';
import { NotificationType, EnrollmentStatus } from '@prisma/client';

@Injectable()
export class RescheduleService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    /* ─────────────────────────────────────────────────────────────────────
     *  STUDENT: create a reschedule request for one of their sessions
     * ───────────────────────────────────────────────────────────────────── */
    async createRequest(userId: number, sessionId: number, dto: CreateRescheduleRequestDto) {
        // Resolve student profile
        const student = await this.prisma.student.findUnique({
            where: { userId },
            include: { user: true },
        });
        if (!student) throw new NotFoundException('Student profile not found');

        // Confirm the session exists and belongs to a class the student is enrolled in
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                class: {
                    include: {
                        enrollments: { where: { studentId: student.id } },
                        tutor: { select: { userId: true } },
                        subject: true,
                    },
                },
            },
        });

        if (!session) throw new NotFoundException('Session not found');
        if (session.class.enrollments.length === 0) {
            throw new ForbiddenException('You are not enrolled in this session\'s class');
        }
        if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
            throw new BadRequestException('Cannot request reschedule for a completed or cancelled session');
        }

        // Prevent duplicate pending requests
        const existing = await this.prisma.rescheduleRequest.findFirst({
            where: { sessionId, studentId: student.id, status: 'PENDING' },
        });
        if (existing) {
            throw new BadRequestException('You already have a pending reschedule request for this session');
        }

        const request = await this.prisma.rescheduleRequest.create({
            data: {
                sessionId,
                studentId: student.id,
                proposedDateTime: new Date(dto.proposedDateTime),
                reason: dto.reason,
            },
            include: {
                session: {
                    include: { class: { include: { subject: true } } },
                },
            },
        });

        // NOTIFICATION: Notify Tutor
        try {
            await this.notificationService.createNotification(
                session.class.tutor.userId,
                'Reschedule Requested',
                `${student.user.firstName} ${student.user.lastName} has requested to reschedule ${session.class.subject.name} - ${session.class.name}.`,
                NotificationType.RESCHEDULE,
                '/dashboard/schedule'
            );
        } catch (error) {
            console.error('Failed to notify tutor of reschedule request:', error);
        }

        return request;
    }

    /* ─────────────────────────────────────────────────────────────────────
     *  STUDENT: list their own reschedule requests
     * ───────────────────────────────────────────────────────────────────── */
    async getStudentRequests(userId: number) {
        const student = await this.prisma.student.findUnique({ where: { userId } });
        if (!student) throw new NotFoundException('Student profile not found');

        return this.prisma.rescheduleRequest.findMany({
            where: { studentId: student.id },
            include: {
                session: {
                    include: { class: { include: { subject: true, tutor: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /* ─────────────────────────────────────────────────────────────────────
     *  TUTOR: list pending reschedule requests for their classes
     * ───────────────────────────────────────────────────────────────────── */
    async getTutorRequests(userId: number) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
        if (!tutor) throw new NotFoundException('Tutor profile not found');

        return this.prisma.rescheduleRequest.findMany({
            where: {
                session: { class: { tutorId: tutor.id } },
            },
            include: {
                session: {
                    include: { class: { include: { subject: true } } },
                },
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true, email: true, profilePicture: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /* ─────────────────────────────────────────────────────────────────────
     *  TUTOR: accept a reschedule request
     *    - Updates the session's dateTime to the proposed one
     *    - Marks the request ACCEPTED
     * ───────────────────────────────────────────────────────────────────── */
    async acceptRequest(userId: number, requestId: number, dto: RespondRescheduleRequestDto) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
        if (!tutor) throw new NotFoundException('Tutor profile not found');

        const request = await this.prisma.rescheduleRequest.findUnique({
            where: { id: requestId },
            include: {
                session: { include: { class: { include: { subject: true } } } },
                student: { select: { userId: true } },
            },
        });

        if (!request) throw new NotFoundException('Reschedule request not found');
        if (request.session.class.tutorId !== tutor.id) {
            throw new ForbiddenException('This request does not belong to one of your classes');
        }
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
        }

        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Create the replacement session at the proposed time
            const newSession = await tx.session.create({
                data: {
                    classId: request.session.classId,
                    dateTime: request.proposedDateTime,
                    duration: request.session.duration,
                    status: 'SCHEDULED',
                },
            });

            // 2. Mark the original session as RESCHEDULED and point it at the new session
            await tx.session.update({
                where: { id: request.sessionId },
                data: {
                    status: 'RESCHEDULED',
                    rescheduledSessionId: newSession.id,
                },
            });

            // 3. Mark the reschedule request ACCEPTED
            return tx.rescheduleRequest.update({
                where: { id: requestId },
                data: { status: 'ACCEPTED', responseReason: dto.responseReason },
                include: {
                    session: { include: { class: { include: { subject: true } } } },
                    student: { include: { user: { select: { firstName: true, lastName: true } } } },
                },
            });
        });

        // NOTIFICATION: Notify Student
        try {
            await this.notificationService.createNotification(
                request.student.userId,
                'Reschedule Accepted',
                `Your tutor has accepted the reschedule request for ${request.session.class.subject.name}. The session is now moved to ${new Date(request.proposedDateTime).toLocaleString()}.`,
                NotificationType.RESCHEDULE,
                '/dashboard/schedule'
            );
        } catch (error) {
            console.error('Failed to notify student of accepted reschedule:', error);
        }

        return result;
    }

    /* ─────────────────────────────────────────────────────────────────────
     *  TUTOR: decline a reschedule request
     * ───────────────────────────────────────────────────────────────────── */
    async declineRequest(userId: number, requestId: number, dto: RespondRescheduleRequestDto) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
        if (!tutor) throw new NotFoundException('Tutor profile not found');

        const request = await this.prisma.rescheduleRequest.findUnique({
            where: { id: requestId },
            include: {
                session: { include: { class: { include: { subject: true } } } },
                student: { select: { userId: true } },
            },
        });

        if (!request) throw new NotFoundException('Reschedule request not found');
        if (request.session.class.tutorId !== tutor.id) {
            throw new ForbiddenException('This request does not belong to one of your classes');
        }
        if (request.status !== 'PENDING') {
            throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);
        }

        const result = await this.prisma.rescheduleRequest.update({
            where: { id: requestId },
            data: { status: 'DECLINED', responseReason: dto.responseReason },
            include: {
                session: { include: { class: { include: { subject: true } } } },
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
        });

        // NOTIFICATION: Notify Student
        try {
            await this.notificationService.createNotification(
                request.student.userId,
                'Reschedule Declined',
                `Your tutor has declined the reschedule request for ${request.session.class.subject.name}.${dto.responseReason ? ` Reason: ${dto.responseReason}` : ''}`,
                NotificationType.RESCHEDULE,
                '/dashboard/schedule'
            );
        } catch (error) {
            console.error('Failed to notify student of declined reschedule:', error);
        }

        return result;
    }

    /* ─────────────────────────────────────────────────────────────────────
     *  STUDENT: cancel their own pending request
     * ───────────────────────────────────────────────────────────────────── */
    async cancelRequest(userId: number, requestId: number) {
        const student = await this.prisma.student.findUnique({ where: { userId } });
        if (!student) throw new NotFoundException('Student profile not found');

        const request = await this.prisma.rescheduleRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Reschedule request not found');
        if (request.studentId !== student.id) throw new ForbiddenException('Access denied');
        if (request.status !== 'PENDING') {
            throw new BadRequestException('Only pending requests can be cancelled');
        }

        return this.prisma.rescheduleRequest.delete({ where: { id: requestId } });
    }

    /* ─────────────────────────────────────────────────────────────────────
     *  STAFF (Tutor/Admin): Reschedule session immediately
     * ───────────────────────────────────────────────────────────────────── */
    async staffReschedule(userId: number, sessionId: number, dto: CreateRescheduleRequestDto) {
        // Resolve user role to ensure they are staff
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const isAdminOrStaff = user.userType === 'ADMIN' || user.userType === 'COORDINATOR';
        const isTutor = user.userType === 'TUTOR';

        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                class: {
                    include: {
                        subject: true,
                        enrollments: {
                            where: { status: EnrollmentStatus.ACTIVE },
                            include: { student: { select: { userId: true } } },
                        },
                    },
                },
            },
        });

        if (!session) throw new NotFoundException('Session not found');

        // If tutor, verify they own the class
        if (isTutor) {
            const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
            if (!tutor || session.class.tutorId !== tutor.id) {
                throw new ForbiddenException('You do not have permission to reschedule this class');
            }
        } else if (!isAdminOrStaff) {
            throw new ForbiddenException('Only staff or tutors can reschedule a class directly');
        }

        if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
            throw new BadRequestException('Cannot reschedule a completed or cancelled session');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Create the replacement session
            const newSession = await tx.session.create({
                data: {
                    classId: session.classId,
                    dateTime: new Date(dto.proposedDateTime),
                    duration: session.duration,
                    status: 'SCHEDULED',
                    link: session.link, // propagate meeting link
                },
            });

            // 2. Mark original as RESCHEDULED
            return tx.session.update({
                where: { id: sessionId },
                data: {
                    status: 'RESCHEDULED',
                    rescheduledSessionId: newSession.id,
                },
            });
        });

        // NOTIFICATION: Notify Students
        try {
            const studentUserIds = session.class.enrollments.map(e => e.student.userId);
            if (studentUserIds.length > 0) {
                await this.notificationService.createManyNotifications(
                    studentUserIds,
                    'Session Rescheduled',
                    `The session for ${session.class.subject.name} has been moved to ${new Date(dto.proposedDateTime).toLocaleString()}.`,
                    NotificationType.CLASS,
                    '/dashboard/schedule'
                );
            }
        } catch (error) {
            console.error('Failed to notify students of staff reschedule:', error);
        }

        return result;
    }
}
