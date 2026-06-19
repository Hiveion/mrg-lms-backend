
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { User, Prisma, UserStatus, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({
            data,
            include: {
                tutorProfile: true,
                studentProfile: true,
                parentProfile: true,
                coordinatorProfile: true,
            },
        });
    }

    async findOne(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                tutorProfile: true,
                studentProfile: true,
                parentProfile: true,
                coordinatorProfile: true,
            },
        });
    }

    async findById(id: number): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
            include: {
                tutorProfile: true,
                studentProfile: true,
                parentProfile: true,
                coordinatorProfile: true,
            },
        });
    }

    async update(id: number, data: Prisma.UserUpdateInput): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
            include: {
                tutorProfile: true,
                studentProfile: true,
                parentProfile: true,
            },
        });
    }

    async updateProfile(
        id: number,
        updateData: {
            firstName?: string;
            lastName?: string;
            phoneNumber?: string;
            timezone?: string;
            userType?: UserRole;
            bio?: string;
            qualifications?: string[];
            grade?: string;
            currency?: string;
            occupation?: string;
            numberOfChildren?: number;
        }
    ): Promise<User> {
        const { bio, qualifications, grade, currency, occupation, numberOfChildren, ...userData } = updateData;

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
        if (updateData.userType === 'STUDENT' && (grade !== undefined || currency !== undefined)) {
            updateObject.studentProfile = {
                upsert: {
                    create: {
                        grade: grade || '',
                        currency: currency || 'MVR',
                    },
                    update: {
                        ...(grade !== undefined && { grade }),
                        ...(currency !== undefined && { currency }),
                    },
                },
            };
        }

        // Handle parent profile update
        if (updateData.userType === 'PARENT' && (occupation !== undefined || numberOfChildren !== undefined)) {
            updateObject.parentProfile = {
                upsert: {
                    create: {
                        occupation: occupation || '',
                        numberOfChildren: numberOfChildren || 0,
                    },
                    update: {
                        ...(occupation !== undefined && { occupation }),
                        ...(numberOfChildren !== undefined && { numberOfChildren }),
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
                parentProfile: true,
                coordinatorProfile: true,
            },
        });
    }

    async findAllTutors() {
        return this.prisma.tutor.findMany({
            where: {
                applicationStatus: 'ACCEPTED',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profilePicture: true,
                        phoneNumber: true,
                    },
                },
                classes: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        grade: true,
                        classFee: true,
                        subject: {
                            select: { name: true },
                        },
                    },
                },
                ratings: {
                    select: {
                        id: true,
                        overallRating: true,
                        teachingQuality: true,
                        communication: true,
                        punctuality: true,
                        review: true,
                        likes: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5, // latest 5 ratings
                },
            },
            orderBy: { averageRating: 'desc' },
        });
    }

    async findAllStudents() {
        return this.prisma.student.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profilePicture: true,
                        phoneNumber: true,
                        timezone: true,
                    },
                },
            },
            orderBy: {
                user: {
                    firstName: 'asc'
                }
            }
        });
    }

    async findMyStudents(userId: number) {
        // First find all students enrolled in any class taught by this tutor.
        // Include their enrollments for this specific tutor's classes.
        return this.prisma.student.findMany({
            where: {
                enrollments: {
                    some: {
                        class: {
                            tutor: {
                                userId: userId
                            }
                        }
                    }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profilePicture: true,
                        phoneNumber: true,
                        status: true,
                    },
                },
                enrollments: {
                    where: {
                        class: {
                            tutor: {
                                userId: userId
                            }
                        }
                    },
                    include: {
                        class: {
                            include: {
                                subject: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                user: {
                    firstName: 'asc'
                }
            }
        });
    }
}
