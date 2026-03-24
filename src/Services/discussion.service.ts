import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { DiscussionType, UserRole } from '@prisma/client';
import { CreateThreadDto, CreateReplyDto } from '../DTOs/discussion.dto';

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

    async createThread(userId: number, dto: CreateThreadDto) {
        return this.prisma.discussionThread.create({
            data: {
                ...dto,
                authorId: userId,
            },
            include: {
                author: true,
                class: true,
            }
        });
    }

    async createReply(userId: number, threadId: number, dto: CreateReplyDto) {
        const thread = await this.prisma.discussionThread.findUnique({ where: { id: threadId } });
        if (!thread) throw new NotFoundException(`Thread with ID ${threadId} not found`);

        return this.prisma.discussionReply.create({
            data: {
                ...dto,
                threadId,
                authorId: userId,
            },
            include: {
                author: true,
            }
        });
    }

    async toggleThreadLike(userId: number, threadId: number) {
        const existingLike = await this.prisma.discussionLike.findUnique({
            where: {
                threadId_userId: { threadId, userId }
            }
        });

        if (existingLike) {
            await this.prisma.discussionLike.delete({
                where: { id: existingLike.id }
            });
            return { liked: false };
        } else {
            await this.prisma.discussionLike.create({
                data: { threadId, userId }
            });
            return { liked: true };
        }
    }

    async toggleReplyLike(userId: number, replyId: number) {
        const existingLike = await this.prisma.replyLike.findUnique({
            where: {
                replyId_userId: { replyId, userId }
            }
        });

        if (existingLike) {
            await this.prisma.replyLike.delete({
                where: { id: existingLike.id }
            });
            return { liked: false };
        } else {
            await this.prisma.replyLike.create({
                data: { replyId, userId }
            });
            return { liked: true };
        }
    }

    async resolveThread(userId: number, userRole: UserRole, threadId: number) {
        const thread = await this.prisma.discussionThread.findUnique({ where: { id: threadId } });
        if (!thread) throw new NotFoundException('Thread not found');

        const isTutorOrAdmin = userRole === UserRole.TUTOR || userRole === UserRole.ADMIN;
        if (thread.authorId !== userId && !isTutorOrAdmin) {
            throw new ForbiddenException('Only the author or a tutor/admin can resolve the thread');
        }

        return this.prisma.discussionThread.update({
            where: { id: threadId },
            data: { resolved: true }
        });
    }

    async markReplyAsAnswer(userId: number, userRole: UserRole, replyId: number) {
        const reply = await this.prisma.discussionReply.findUnique({
            where: { id: replyId },
            include: { thread: true }
        });
        if (!reply) throw new NotFoundException('Reply not found');

        const isTutorOrAdmin = userRole === UserRole.TUTOR || userRole === UserRole.ADMIN;
        if (reply.thread.authorId !== userId && !isTutorOrAdmin) {
            throw new ForbiddenException('Only the thread author or a tutor/admin can mark the answer');
        }

        return this.prisma.$transaction([
            this.prisma.discussionReply.updateMany({
                where: { threadId: reply.threadId },
                data: { isAnswer: false }
            }),
            this.prisma.discussionReply.update({
                where: { id: replyId },
                data: { isAnswer: true }
            }),
            this.prisma.discussionThread.update({
                where: { id: reply.threadId },
                data: { resolved: true }
            })
        ]);
    }
}
