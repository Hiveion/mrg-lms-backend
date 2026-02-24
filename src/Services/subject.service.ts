import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from '../DTOs/subject.dto';

@Injectable()
export class SubjectService {
    constructor(private prisma: PrismaService) { }

    async create(createSubjectDto: CreateSubjectDto) {
        try {
            return await this.prisma.subject.create({
                data: createSubjectDto,
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Subject name or code already exists');
            }
            throw error;
        }
    }

    async findAll() {
        return this.prisma.subject.findMany({
            include: {
                classes: true,
            },
        });
    }

    async findOne(id: number) {
        const subject = await this.prisma.subject.findUnique({
            where: { id },
            include: {
                classes: true,
            },
        });

        if (!subject) {
            throw new NotFoundException(`Subject with ID ${id} not found`);
        }

        return subject;
    }

    async update(id: number, updateSubjectDto: UpdateSubjectDto) {
        try {
            const subject = await this.prisma.subject.update({
                where: { id },
                data: updateSubjectDto,
            });

            if (!subject) {
                throw new NotFoundException(`Subject with ID ${id} not found`);
            }

            return subject;
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Subject with ID ${id} not found`);
            }
            if (error.code === 'P2002') {
                throw new ConflictException('Subject name or code already exists');
            }
            throw error;
        }
    }

    async remove(id: number) {
        try {
            return await this.prisma.subject.delete({
                where: { id },
            });
        } catch (error) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Subject with ID ${id} not found`);
            }
            throw error;
        }
    }
}
