import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto, UpdateAssignedPriceDto } from '../DTOs/enrollment.dto';
import { EnrollmentStatus, UserRole } from '@prisma/client';

@Injectable()
export class EnrollmentService {
    constructor(
        private prisma: PrismaService,
    ) { }

    async create(createEnrollmentDto: CreateEnrollmentDto) {
        // Check if student exists
        const student = await this.prisma.student.findUnique({
            where: { id: createEnrollmentDto.studentId },
        });
        if (!student) {
            throw new NotFoundException(`Student with ID ${createEnrollmentDto.studentId} not found`);
        }

        // Check if class exists
        const classItem = await this.prisma.class.findUnique({
            where: { id: createEnrollmentDto.classId },
        });
        if (!classItem) {
            throw new NotFoundException(`Class with ID ${createEnrollmentDto.classId} not found`);
        }

        // Amount defaults to the class's advertised student rate; currency always follows
        // the enrolling student's own currency. No conversion happens between the two.
        const assignedPrice = createEnrollmentDto.assignedPrice !== undefined
            ? createEnrollmentDto.assignedPrice
            : (classItem.studentRateAmount ?? 0);
        const priceCurrency = createEnrollmentDto.priceCurrency ?? student.currency;

        try {
            return await this.prisma.$transaction(async (tx) => {
                await tx.class.update({
                    where: { id: createEnrollmentDto.classId },
                    data: {
                        currentStudentCount: { increment: 1 },
                    },
                });

                // studentId+classId is unique at the DB level, so a concurrent duplicate
                // enrollment attempt lands here as a clean P2002 instead of succeeding twice.
                const enrollment = await tx.enrollment.create({
                    data: {
                        ...createEnrollmentDto,
                        assignedPrice,
                        priceCurrency,
                        status: createEnrollmentDto.status || EnrollmentStatus.REQUESTED,
                    },
                    include: {
                        student: { include: { user: true } },
                        class: { include: { subject: true } },
                    },
                });

                return enrollment;
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new ConflictException('Student is already enrolled in this class');
            }
            throw error;
        }
    }

    async findAll() {
        return this.prisma.enrollment.findMany({
            include: {
                student: { include: { user: true } },
                class: { include: { subject: true } },
            },
        });
    }

    async findOne(id: number) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id },
            include: {
                student: { include: { user: true } },
                class: { include: { subject: true } },
            },
        });

        if (!enrollment) {
            throw new NotFoundException(`Enrollment with ID ${id} not found`);
        }

        return enrollment;
    }

    async update(id: number, updateEnrollmentDto: UpdateEnrollmentDto) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id },
        });
        if (!enrollment) {
            throw new NotFoundException(`Enrollment with ID ${id} not found`);
        }

        // Automatically set confirmationDate if status becomes ACTIVE
        const data: any = { ...updateEnrollmentDto };
        if (updateEnrollmentDto.status === EnrollmentStatus.ACTIVE && !enrollment.confirmationDate) {
            data.confirmationDate = new Date();
        }

        return this.prisma.enrollment.update({
            where: { id },
            data,
            include: {
                student: { include: { user: true } },
                class: { include: { subject: true } },
            },
        });
    }

    async updateAssignedPrice(id: number, updatePriceDto: UpdateAssignedPriceDto) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id },
        });
        if (!enrollment) {
            throw new NotFoundException(`Enrollment with ID ${id} not found`);
        }

        return this.prisma.enrollment.update({
            where: { id },
            data: {
                assignedPrice: updatePriceDto.assignedPrice,
                ...(updatePriceDto.priceCurrency !== undefined && { priceCurrency: updatePriceDto.priceCurrency }),
            },
        });
    }

    async findByStudentUserId(userId: number) {
        return this.prisma.enrollment.findMany({
            where: {
                student: {
                    userId: userId,
                },
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: {
                                user: true,
                            },
                        },
                        schedules: {
                            orderBy: { day: 'asc' },
                        },
                    },
                },
            },
        });
    }

    async findByStudentUserIdForStudent(userId: number, userRole: string | UserRole) {
        return this.findByStudentUserId(userId);
    }

    async findNextSessions(userId: number) {
        const now = new Date();

        // Find all active enrollments for the student
        const activeEnrollments = await this.prisma.enrollment.findMany({
            where: {
                student: { userId: userId },
                status: EnrollmentStatus.ACTIVE,
            },
            select: {
                classId: true,
            },
        });

        const classIds = activeEnrollments.map(e => e.classId);

        if (classIds.length === 0) {
            return [];
        }

        // For each class, find the next upcoming session
        const sessions = await Promise.all(
            classIds.map(classId =>
                this.prisma.session.findFirst({
                    where: {
                        classId: classId,
                        dateTime: {
                            gt: now,
                        },
                        status: 'SCHEDULED',
                    },
                    orderBy: {
                        dateTime: 'asc',
                    },
                    include: {
                        class: {
                            include: {
                                subject: true,
                                tutor: {
                                    include: {
                                        user: true,
                                    },
                                },
                            },
                        },
                    },
                })
            )
        );

        // Filter out nulls (classes without upcoming sessions) and sort by date
        return sessions
            .filter(session => session !== null)
            .sort((a, b) => a!.dateTime.getTime() - b!.dateTime.getTime());
    }

    async remove(id: number) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id },
        });

        if (!enrollment) {
            throw new NotFoundException(`Enrollment with ID ${id} not found`);
        }

        return this.prisma.$transaction(async (tx) => {
            const deletedEnrollment = await tx.enrollment.delete({
                where: { id },
            });

            await tx.class.update({
                where: { id: enrollment.classId },
                data: {
                    currentStudentCount: {
                        decrement: 1,
                    },
                },
            });

            return deletedEnrollment;
        });
    }

    async toggleRecordingAccess(enrollmentId: number, enabled: boolean) {
        return this.prisma.enrollment.update({
            where: { id: enrollmentId },
            data: { recordingAccess: enabled },
            select: {
                id: true,
                recordingAccess: true,
                student: {
                    select: {
                        user: {
                            select: { firstName: true, lastName: true, email: true }
                        }
                    }
                }
            },
        });
    }
}
