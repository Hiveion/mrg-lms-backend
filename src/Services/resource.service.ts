import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateResourceDto, UpdateResourceDto } from '../DTOs/resource.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ResourceService {
    constructor(private prisma: PrismaService) { }

    async create(userId: number, dto: CreateResourceDto) {
        const { classId, title, description, fileUrl, fileType, fileSize } = dto;

        const targetClass = await this.prisma.class.findUnique({
            where: { id: classId },
            include: { tutor: true }
        });

        if (!targetClass) {
            throw new NotFoundException('Class not found');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.userType !== UserRole.ADMIN && (user.userType !== UserRole.TUTOR || targetClass.tutor.userId !== userId)) {
            throw new ForbiddenException('You do not have permission to upload resources to this class');
        }

        return this.prisma.resource.create({
            data: {
                classId,
                uploaderId: userId,
                title,
                description,
                fileUrl,
                fileType,
                fileSize,
            },
            include: {
                uploader: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    }

    async findByClass(userId: number, classId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.userType !== UserRole.ADMIN) {
            if (user.userType === UserRole.STUDENT) {
                const student = await this.prisma.student.findUnique({ where: { userId } });
                if (!student) {
                    throw new ForbiddenException('Student profile not found');
                }
                const enrollment = await this.prisma.enrollment.findFirst({
                    where: { classId, studentId: student.id, status: 'ACTIVE' }
                });
                if (!enrollment) {
                    throw new ForbiddenException('You are not enrolled in this class');
                }
            }
            else if (user.userType === UserRole.TUTOR) {
                const targetClass = await this.prisma.class.findUnique({
                    where: { id: classId },
                    include: { tutor: true }
                });
                if (!targetClass || targetClass.tutor.userId !== userId) {
                    throw new ForbiddenException('You do not have access to this class resources');
                }
            }
        }

        return this.prisma.resource.findMany({
            where: { classId },
            include: {
                uploader: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async update(userId: number, resourceId: number, dto: UpdateResourceDto) {
        const resource = await this.prisma.resource.findUnique({
            where: { id: resourceId },
            include: { uploader: true }
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }

        if (resource.uploaderId !== userId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.userType !== UserRole.ADMIN) {
                throw new ForbiddenException('Only uploader or Admin can update this resource');
            }
        }

        return this.prisma.resource.update({
            where: { id: resourceId },
            data: dto
        });
    }

    async remove(userId: number, resourceId: number) {
        const resource = await this.prisma.resource.findUnique({
            where: { id: resourceId }
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }

        if (resource.uploaderId !== userId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.userType !== UserRole.ADMIN) {
                throw new ForbiddenException('Only uploader or Admin can delete this resource');
            }
        }

        return this.prisma.resource.delete({
            where: { id: resourceId }
        });
    }

    async findMyResources(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                studentProfile: true,
                tutorProfile: true
            }
        });

        if (!user) throw new NotFoundException('User not found');

        let classIds: number[] = [];

        if (user.userType === UserRole.ADMIN || user.userType === UserRole.COORDINATOR) {
            // Can see all resources? For now let's just return all or a reasonable set.
            return this.prisma.resource.findMany({
                include: {
                    class: { select: { name: true } },
                    uploader: { select: { firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        } else if (user.userType === UserRole.TUTOR) {
            if (!user.tutorProfile) throw new NotFoundException('Tutor profile not found');
            const classes = await this.prisma.class.findMany({
                where: { tutorId: user.tutorProfile.id }
            });
            classIds = classes.map(c => c.id);
        } else if (user.userType === UserRole.STUDENT) {
            if (!user.studentProfile) throw new NotFoundException('Student profile not found');
            const enrollments = await this.prisma.enrollment.findMany({
                where: { studentId: user.studentProfile.id, status: 'ACTIVE' }
            });
            classIds = enrollments.map(e => e.classId);
        }

        return this.prisma.resource.findMany({
            where: { classId: { in: classIds } },
            include: {
                class: { select: { name: true } },
                uploader: { select: { firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async incrementDownload(resourceId: number) {
        const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
        if (!resource) {
            throw new NotFoundException('Resource not found');
        }
        return this.prisma.resource.update({
            where: { id: resourceId },
            data: {
                downloadCount: {
                    increment: 1
                }
            }
        });
    }
}
