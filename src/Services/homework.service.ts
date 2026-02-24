import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateHomeworkDto } from '../DTOs/homework.dto';
import { HomeworkType } from '@prisma/client';

@Injectable()
export class HomeworkService {
    constructor(private prisma: PrismaService) { }

    async create(createHomeworkDto: CreateHomeworkDto) {
        const { questions, ...homeworkData } = createHomeworkDto;

        // Validate class exists
        const classItem = await this.prisma.class.findUnique({
            where: { id: homeworkData.classId },
        });
        if (!classItem) {
            throw new NotFoundException(`Class with ID ${homeworkData.classId} not found`);
        }

        // Business Logic Validation
        if (homeworkData.type === HomeworkType.QUIZ && (!questions || questions.length === 0)) {
            throw new BadRequestException('Quiz type homework must have at least one question');
        }

        if (homeworkData.type === HomeworkType.FILE && !homeworkData.fileUrl) {
            throw new BadRequestException('File type homework must have a file URL');
        }

        return this.prisma.homework.create({
            data: {
                ...homeworkData,
                deadlineDate: homeworkData.deadlineDate ? new Date(homeworkData.deadlineDate) : null,
                questions: questions ? {
                    create: questions
                } : undefined,
            },
            include: {
                questions: true,
                class: true,
            },
        });
    }

    async findAll() {
        return this.prisma.homework.findMany({
            include: {
                class: true,
                questions: true,
            },
        });
    }

    async findOne(id: number) {
        const homework = await this.prisma.homework.findUnique({
            where: { id },
            include: {
                class: true,
                questions: true,
            },
        });
        if (!homework) {
            throw new NotFoundException(`Homework with ID ${id} not found`);
        }
        return homework;
    }

    async findByClass(classId: number) {
        return this.prisma.homework.findMany({
            where: { classId },
            include: {
                questions: true,
            },
        });
    }
}
