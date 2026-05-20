import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { UserRole, SessionRecordingStatus } from '@prisma/client';

@Injectable()
export class RecordingService {
    constructor(private readonly prisma: PrismaService) { }

    // Get all sessions with saved recordings (admin/coordinator sees all)
    async findAll() {
        return this.prisma.session.findMany({
            where: {
                recordingStatus: SessionRecordingStatus.SAVED,
                recordingUrl: { not: null },
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true }
                        }
                    }
                }
            },
            orderBy: { dateTime: 'desc' },
        });
    }

    // Get recordings for tutor's classes only
    async findByTutor(userId: number) {
        return this.prisma.session.findMany({
            where: {
                recordingStatus: SessionRecordingStatus.SAVED,
                recordingUrl: { not: null },
                class: {
                    tutor: { userId }
                }
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true }
                        }
                    }
                }
            },
            orderBy: { dateTime: 'desc' },
        });
    }

    // Get recordings for classes student is enrolled in
    async findByStudent(userId: number) {
        return this.prisma.session.findMany({
            where: {
                recordingStatus: SessionRecordingStatus.SAVED,
                recordingUrl: { not: null },
                class: {
                    enrollments: {
                        some: {
                            student: { userId }
                        }
                    }
                }
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true }
                        }
                    }
                }
            },
            orderBy: { dateTime: 'desc' },
        });
    }

    // Get single session recording
    async findOne(sessionId: number) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true }
                        }
                    }
                }
            }
        });

        if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
        if (!session.recordingUrl) throw new NotFoundException(`No recording found for session ${sessionId}`);

        return session;
    }

    // Check if user can access this session's recording
    async authorizeAccess(sessionId: number, userId: number, role: UserRole): Promise<boolean> {
        if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) return true;

        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                class: {
                    include: {
                        tutor: true,
                        enrollments: {
                            include: { student: true }
                        }
                    }
                }
            }
        });

        if (!session) throw new NotFoundException('Session not found');

        if (role === UserRole.TUTOR) {
            return session.class.tutor?.userId === userId;
        }

        if (role === UserRole.STUDENT) {
            return session.class.enrollments.some(e => e.student.userId === userId);
        }

        return false;
    }
}
