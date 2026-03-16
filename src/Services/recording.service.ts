import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateRecordingDto, UpdateRecordingDto } from '../DTOs/recording.dto';
import { RecordingStatus, UserRole, SessionStatus } from '@prisma/client';

@Injectable()
export class RecordingService {
    constructor(private readonly prisma: PrismaService) { }

    async validateRecordingCreation(userId: number, userType: UserRole, classId: number) {
        if (userType === UserRole.ADMIN || userType === UserRole.COORDINATOR) {
            return true;
        }

        if (userType === UserRole.TUTOR) {
            const classItem = await this.prisma.class.findUnique({
                where: { id: classId },
                include: { tutor: true },
            });
            return classItem?.tutor?.userId === userId;
        }

        return false;
    }

    async create(createRecordingDto: CreateRecordingDto, userId: number, userType: UserRole) {
        const hasPermission = await this.validateRecordingCreation(userId, userType, createRecordingDto.classId);
        if (!hasPermission) {
            throw new ForbiddenException('You do not have permission to create recordings for this class');
        }

        return this.prisma.recording.create({
            data: {
                ...createRecordingDto,
                expiresAt: new Date(createRecordingDto.expiresAt),
            },
            include: {
                class: true,
                session: true,
            },
        });
    }

    async findAll() {
        return this.prisma.recording.findMany({
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        dateTime: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findByStudent(userId: number) {
        // Find recordings for classes where the student is enrolled
        return this.prisma.recording.findMany({
            where: {
                class: {
                    enrollments: {
                        some: {
                            student: {
                                userId: userId,
                            },
                        },
                    },
                },
                status: {
                    not: RecordingStatus.EXPIRED,
                },
            },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        dateTime: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findByTutor(userId: number) {
        // Find recordings for classes where the tutor is assigned
        return this.prisma.recording.findMany({
            where: {
                class: {
                    tutor: {
                        userId: userId,
                    },
                },
            },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        dateTime: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: number) {
        const recording = await this.prisma.recording.findUnique({
            where: { id },
            include: {
                class: true,
                session: true,
            },
        });

        if (!recording) {
            throw new NotFoundException(`Recording with ID ${id} not found`);
        }

        return recording;
    }

    async update(id: number, updateRecordingDto: UpdateRecordingDto) {
        const data = { ...updateRecordingDto };
        if (updateRecordingDto.expiresAt) {
            (data as any).expiresAt = new Date(updateRecordingDto.expiresAt);
        }

        return this.prisma.recording.update({
            where: { id },
            data,
            include: {
                class: true,
                session: true,
            },
        });
    }

    async remove(id: number) {
        return this.prisma.recording.delete({
            where: { id },
        });
    }

    async incrementViewCount(id: number) {
        return this.prisma.recording.update({
            where: { id },
            data: {
                viewCount: {
                    increment: 1,
                },
            },
        });
    }

    async authorizeRecordingAccess(recordingId: number, userId: number, role: UserRole) {
        if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
            return true;
        }

        const recording = await this.prisma.recording.findUnique({
            where: { id: recordingId },
            include: {
                class: {
                    include: {
                        enrollments: {
                            include: {
                                student: true,
                            },
                        },
                        tutor: true,
                    },
                },
            },
        });

        if (!recording) {
            throw new NotFoundException('Recording not found');
        }

        if (role === UserRole.TUTOR) {
            return recording.class.tutor.userId === userId;
        }

        if (role === UserRole.STUDENT) {
            return recording.class.enrollments.some(e => e.student.userId === userId);
        }

        return false;
    }

    async getRecordingMetadata(userId: number, userType: UserRole) {
        const classes = await this.prisma.class.findMany({
            where: userType === UserRole.TUTOR ? { tutor: { userId } } : {},
            include: {
                sessions: {
                    where: {
                        status: SessionStatus.COMPLETED,
                    },
                    include: {
                        recording: true
                    }
                }
            }
        });

        return classes.map(c => ({
            id: c.id,
            name: c.name,
            sessions: (c as any).sessions.filter(s => !s.recording)
        })).filter(c => c.sessions.length > 0);
    }
}
