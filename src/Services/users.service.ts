
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { User, Prisma, UserStatus } from '@prisma/client';

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
}
