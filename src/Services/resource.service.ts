import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { GoogleService } from './google.service';
import { CreateResourceDto } from '../DTOs/resource.dto';
import { UserRole, EnrollmentStatus } from '@prisma/client';

@Injectable()
export class ResourceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly googleService: GoogleService,
    ) { }

    async create(dto: CreateResourceDto, uploaderId: number, uploaderRole: UserRole, file: any) {
        if (!file) {
            throw new BadRequestException('File is required to upload resource');
        }

        // Validate class
        const classItem = await this.prisma.class.findUnique({
            where: { id: dto.classId },
            include: { tutor: true },
        });

        if (!classItem) {
            throw new NotFoundException(`Class with ID ${dto.classId} not found`);
        }

        // Tutors can only select their own classes
        if (uploaderRole === UserRole.TUTOR) {
            if (classItem.tutor.userId !== uploaderId) {
                throw new ForbiddenException('You can only upload resources to your own classes');
            }
        }

        // Upload to Drive folder 'resources'
        const uploadResult = await this.googleService.uploadFile(uploaderId, file, 'resources');
        if (!uploadResult) {
            throw new BadRequestException('Failed to upload file to Google Drive');
        }

        return this.prisma.resource.create({
            data: {
                classId: dto.classId,
                title: dto.title,
                description: dto.description,
                fileUrl: uploadResult.webViewLink,
                fileId: uploadResult.fileId,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedById: uploaderId,
            },
            include: {
                class: {
                    include: {
                        subject: true
                    }
                },
                uploadedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
    }

    async findAllForUser(userId: number, role: UserRole) {
        if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
            return this.prisma.resource.findMany({
                include: {
                    class: { include: { subject: true } },
                    uploadedBy: { select: { firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (role === UserRole.TUTOR) {
            return this.prisma.resource.findMany({
                where: {
                    class: { tutor: { userId } }
                },
                include: {
                    class: { include: { subject: true } },
                    uploadedBy: { select: { firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (role === UserRole.STUDENT) {
            return this.prisma.resource.findMany({
                where: {
                    class: {
                        enrollments: {
                            some: {
                                student: { userId },
                                status: EnrollmentStatus.ACTIVE
                            }
                        }
                    }
                },
                include: {
                    class: { include: { subject: true } },
                    uploadedBy: { select: { firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        return [];
    }

    async findOne(id: number) {
        const resource = await this.prisma.resource.findUnique({
            where: { id },
            include: {
                class: { include: { subject: true, tutor: { include: { user: true } } } },
                uploadedBy: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        if (!resource) {
            throw new NotFoundException(`Resource with ID ${id} not found`);
        }

        return resource;
    }

    async remove(id: number, userId: number, role: UserRole) {
        const resource = await this.findOne(id);

        // Access check for deletion: uploader, or class tutor, or admin
        const isAdmin = role === UserRole.ADMIN || role === UserRole.COORDINATOR;
        const isUploader = resource.uploadedById === userId;
        const isClassTutor = resource.class.tutor.userId === userId;

        if (!isAdmin && !isUploader && !isClassTutor) {
            throw new ForbiddenException('You do not have permission to delete this resource');
        }

        // Try deleting from Google Drive
        try {
            const driveUser = resource.class.tutor.user.googleRefreshToken
                ? resource.class.tutor.user
                : await this.prisma.user.findFirst({ where: { NOT: { googleRefreshToken: null } } });

            if (driveUser) {
                this.googleService.oauth2Client.setCredentials({
                    refresh_token: driveUser.googleRefreshToken,
                    access_token: driveUser.googleAccessToken,
                });
                const drive = require('googleapis').google.drive({ version: 'v3', auth: this.googleService.oauth2Client });
                await drive.files.delete({ fileId: resource.fileId });
            }
        } catch (err: any) {
            // Log warning but continue deleting from db
            console.warn(`Could not delete file from drive: ${err.message}`);
        }

        return this.prisma.resource.delete({
            where: { id }
        });
    }

    async authorizeAccess(id: number, userId: number, role: UserRole): Promise<boolean> {
        if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) return true;

        const resource = await this.prisma.resource.findUnique({
            where: { id },
            include: {
                class: {
                    include: {
                        tutor: true,
                        enrollments: {
                            include: {
                                student: true
                            }
                        }
                    }
                }
            }
        });

        if (!resource) throw new NotFoundException('Resource not found');

        if (role === UserRole.TUTOR) {
            return resource.class.tutor?.userId === userId;
        }

        if (role === UserRole.STUDENT) {
            return resource.class.enrollments.some(
                e => e.student.userId === userId && e.status === EnrollmentStatus.ACTIVE
            );
        }

        return false;
    }

    async incrementDownloadCount(id: number) {
        return this.prisma.resource.update({
            where: { id },
            data: {
                downloadCount: {
                    increment: 1
                }
            }
        });
    }
}
