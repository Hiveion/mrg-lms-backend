import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateSessionDto, UpdateSessionDto } from '../DTOs/session.dto';

@Injectable()
export class SessionService {
    constructor(private prisma: PrismaService) { }

    async create(createSessionDto: CreateSessionDto) {
        const classItem = await this.prisma.class.findUnique({
            where: { id: createSessionDto.classId },
        });
        if (!classItem) {
            throw new NotFoundException(`Class with ID ${createSessionDto.classId} not found`);
        }

        return this.prisma.session.create({
            data: {
                ...createSessionDto,
                dateTime: new Date(createSessionDto.dateTime),
            },
            include: {
                class: true,
            },
        });
    }

    async findAll() {
        return this.prisma.session.findMany({
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true },
                        },
                    },
                },
            },
        });
    }

    async findOne(id: number) {
        const session = await this.prisma.session.findUnique({
            where: { id },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            include: { user: true },
                        },
                    },
                },
            },
        });

        if (!session) {
            throw new NotFoundException(`Session with ID ${id} not found`);
        }

        return session;
    }

    async update(id: number, updateSessionDto: UpdateSessionDto) {
        const sessionExists = await this.prisma.session.findUnique({
            where: { id },
        });
        if (!sessionExists) {
            throw new NotFoundException(`Session with ID ${id} not found`);
        }

        return this.prisma.session.update({
            where: { id },
            data: {
                ...updateSessionDto,
                dateTime: updateSessionDto.dateTime ? new Date(updateSessionDto.dateTime) : undefined,
            },
            include: {
                class: true,
            },
        });
    }

    async remove(id: number) {
        try {
            return await this.prisma.session.delete({
                where: { id },
            });
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Session with ID ${id} not found`);
            }
            throw error;
        }
    }
}
