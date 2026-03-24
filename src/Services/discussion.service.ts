import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { DiscussionType } from '@prisma/client';

@Injectable()
export class DiscussionService {
    constructor(private prisma: PrismaService) { }

    async findAll(query: { classId?: string, type?: string, search?: string }) {
        const where: any = {};

        if (query.classId && query.classId !== 'all') {
            where.classId = parseInt(query.classId);
        }

        if (query.type && query.type !== 'all') {
            where.type = query.type.toUpperCase() as DiscussionType;
        }

        if (query.search) {
            where.OR = [
                { title: { contains: query.search, mode: 'insensitive' } },
                { body: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.discussionThread.findMany({
            where,
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        userType: true,
                        profilePicture: true,
                    }
                },
                class: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                _count: {
                    select: {
                        replies: true,
                        likes: true,
                    }
                }
            },
            orderBy: [
                { pinned: 'desc' },
                { createdAt: 'desc' },
            ]
        });
    }

    async findOne(id: number) {
        const thread = await this.prisma.discussionThread.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        userType: true,
                        profilePicture: true,
                    }
                },
                class: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                replies: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                userType: true,
                                profilePicture: true,
                            }
                        },
                        likes: true,
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                },
                likes: true,
            }
        });

        if (!thread) {
            throw new NotFoundException(`Thread with ID ${id} not found`);
        }

        return thread;
    }
}
