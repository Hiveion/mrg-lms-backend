
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { User, Prisma, UserStatus, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({
            data: {
                ...data,
                status: UserStatus.PENDING, // Default status
            },
            include: {
                tutorProfile: true,
                studentProfile: true,
            },
        });
    }

    async findOne(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findById(id: number): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async update(id: number, data: Prisma.UserUpdateInput): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
            include: {
                tutorProfile: true,
                studentProfile: true,
            },
        });
    }

    async updateProfile(
        id: number,
        updateData: {
            firstName?: string;
            lastName?: string;
            phoneNumber?: string;
            userType?: UserRole;
            bio?: string;
            qualifications?: string[];
            grade?: string;
        }
    ): Promise<User> {
        const { bio, qualifications, grade, ...userData } = updateData;

        // Build the update object
        const updateObject: Prisma.UserUpdateInput = {
            ...userData,
        };

        // Handle tutor profile update
        if (updateData.userType === 'TUTOR' && (bio !== undefined || qualifications !== undefined)) {
            updateObject.tutorProfile = {
                upsert: {
                    create: {
                        bio: bio || '',
                        qualifications: qualifications || [],
                    },
                    update: {
                        ...(bio !== undefined && { bio }),
                        ...(qualifications !== undefined && { qualifications }),
                    },
                },
            };
        }

        // Handle student profile update
        if (updateData.userType === 'STUDENT' && grade !== undefined) {
            updateObject.studentProfile = {
                upsert: {
                    create: {
                        grade: grade || '',
                    },
                    update: {
                        grade,
                    },
                },
            };
        }

        return this.prisma.user.update({
            where: { id },
            data: updateObject,
            include: {
                tutorProfile: true,
                studentProfile: true,
            },
        });
    }
}
