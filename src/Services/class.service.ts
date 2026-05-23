import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateClassDto, UpdateClassDto } from '../DTOs/class.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ClassService {
    constructor(private prisma: PrismaService) { }

    async create(createClassDto: CreateClassDto) {
        // Check if subject exists
        const subject = await this.prisma.subject.findUnique({
            where: { id: createClassDto.subjectId },
        });
        if (!subject) {
            throw new NotFoundException(`Subject with ID ${createClassDto.subjectId} not found`);
        }

        // Check if tutor exists
        const tutor = await this.prisma.tutor.findUnique({
            where: { id: createClassDto.tutorId },
        });
        if (!tutor) {
            throw new NotFoundException(`Tutor with ID ${createClassDto.tutorId} not found`);
        }

        return this.prisma.class.create({
            data: createClassDto,
            include: {
                subject: true,
                tutor: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }

    async findAll() {
        return this.prisma.class.findMany({
            include: {
                subject: true,
                tutor: {
                    include: {
                        user: true,
                    },
                },
                sessions: true,
                schedules: {
                    orderBy: { day: 'asc' },
                },
            },
        });
    }

    async findMyClasses(userId: number, userRole: string | UserRole) {
        const roleStr = userRole?.toString().toUpperCase();

        if (roleStr === 'ADMIN' || roleStr === 'COORDINATOR') {
            return this.prisma.class.findMany({
                where: { isActive: true },
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
            });
        }

        return this.prisma.class.findMany({
            where: {
                isActive: true,
                OR: [
                    { tutor: { userId: userId } },
                    { enrollments: { some: { student: { userId: userId } } } },
                ],
            },
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
        });
    }

    async findOne(id: number) {
        const classItem = await this.prisma.class.findUnique({
            where: { id },
            include: {
                subject: true,
                tutor: {
                    include: {
                        user: true,
                    },
                },
                sessions: true,
                schedules: {
                    orderBy: { day: 'asc' },
                },
            },
        });

        if (!classItem) {
            throw new NotFoundException(`Class with ID ${id} not found`);
        }

        return classItem;
    }

    async update(id: number, updateClassDto: UpdateClassDto) {
        // Check if class exists
        const existingClass = await this.prisma.class.findUnique({
            where: { id },
        });
        if (!existingClass) {
            throw new NotFoundException(`Class with ID ${id} not found`);
        }

        // If subjectId is being updated, check if it exists
        if (updateClassDto.subjectId) {
            const subject = await this.prisma.subject.findUnique({
                where: { id: updateClassDto.subjectId },
            });
            if (!subject) {
                throw new NotFoundException(`Subject with ID ${updateClassDto.subjectId} not found`);
            }
        }

        // If tutorId is being updated, check if it exists
        if (updateClassDto.tutorId) {
            const tutor = await this.prisma.tutor.findUnique({
                where: { id: updateClassDto.tutorId },
            });
            if (!tutor) {
                throw new NotFoundException(`Tutor with ID ${updateClassDto.tutorId} not found`);
            }
        }

        return this.prisma.class.update({
            where: { id },
            data: updateClassDto,
            include: {
                subject: true,
                tutor: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }

    async remove(id: number) {
        try {
            return await this.prisma.class.delete({
                where: { id },
            });
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Class with ID ${id} not found`);
            }
            throw error;
        }
    }
}
