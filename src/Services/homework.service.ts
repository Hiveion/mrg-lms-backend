import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateHomeworkDto, CreateHomeworkSubmissionDto, GradeSubmissionDto } from '../DTOs/homework.dto';
import { HomeworkType, SubmissionStatus } from '@prisma/client';

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

    async findByStudentUserId(userId: number) {
        return this.prisma.homework.findMany({
            where: {
                class: {
                    enrollments: {
                        some: {
                            student: {
                                userId: userId,
                            },
                        },
                    },
                },
            },
            include: {
                class: {
                    include: {
                        subject: true,
                        tutor: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        profilePicture: true,
                                    },
                                },
                            },
                        },
                    },
                },
                questions: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async submit(userId: number, submissionDto: CreateHomeworkSubmissionDto) {
        const homework = await this.prisma.homework.findUnique({
            where: { id: submissionDto.homeworkId },
        });

        if (!homework) {
            throw new NotFoundException(`Homework with ID ${submissionDto.homeworkId} not found`);
        }

        // Get student profile
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        // Check enrollment
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                studentId_classId: {
                    studentId: student.id,
                    classId: homework.classId,
                },
            },
        });

        if (!enrollment) {
            throw new BadRequestException('Student is not enrolled in this class');
        }

        // Determine status (SUBMITTED or LATE)
        const now = new Date();
        let status: SubmissionStatus = SubmissionStatus.SUBMITTED;

        if (homework.deadlineType === 'FIXED_DATE' && homework.deadlineDate && now > homework.deadlineDate) {
            status = SubmissionStatus.LATE;
        } else if (homework.deadlineType === 'RELATIVE' && homework.deadlineDays) {
            const deadline = new Date(homework.createdAt);
            deadline.setDate(deadline.getDate() + homework.deadlineDays);
            if (now > deadline) {
                status = SubmissionStatus.LATE;
            }
        }

        return this.prisma.homeworkSubmission.create({
            data: {
                homeworkId: homework.id,
                studentId: student.id,
                status,
                submissionFileUrl: submissionDto.submissionFileUrl,
                answers: submissionDto.answers ? {
                    create: submissionDto.answers.map(ans => ({
                        questionId: ans.questionId,
                        answerText: ans.answerText,
                    }))
                } : undefined,
            },
            include: {
                answers: {
                    include: {
                        question: true,
                    },
                },
                homework: true,
            },
        });
    }

    async getMySubmissions(userId: number) {
        // Get student profile
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        return this.prisma.homeworkSubmission.findMany({
            where: { studentId: student.id },
            include: {
                homework: {
                    include: {
                        class: {
                            include: {
                                subject: true,
                            },
                        },
                    },
                },
                answers: {
                    include: {
                        question: true,
                    },
                },
            },
            orderBy: {
                submittedAt: 'desc',
            },
        });
    }

    async getMyLateSubmissions(userId: number) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        return this.prisma.homeworkSubmission.findMany({
            where: {
                studentId: student.id,
                status: SubmissionStatus.LATE,
            },
            include: {
                homework: {
                    include: {
                        class: {
                            include: {
                                subject: true,
                            },
                        },
                    },
                },
                answers: {
                    include: {
                        question: true,
                    },
                },
            },
            orderBy: {
                submittedAt: 'desc',
            },
        });
    }

    async getMyGradedSubmissions(userId: number) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        return this.prisma.homeworkSubmission.findMany({
            where: {
                studentId: student.id,
                status: SubmissionStatus.GRADED,
            },
            include: {
                homework: {
                    include: {
                        class: {
                            include: {
                                subject: true,
                            },
                        },
                    },
                },
                answers: {
                    include: {
                        question: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    }

    async getSubmissionsByHomework(homeworkId: number) {
        return this.prisma.homeworkSubmission.findMany({
            where: { homeworkId },
            include: {
                student: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                                profilePicture: true,
                            },
                        },
                    },
                },
                homework: true,
                answers: {
                    include: {
                        question: true,
                    },
                },
            },
            orderBy: {
                submittedAt: 'desc',
            },
        });
    }

    async grade(submissionId: number, gradeDto: GradeSubmissionDto) {
        const submission = await this.prisma.homeworkSubmission.findUnique({
            where: { id: submissionId },
        });

        if (!submission) {
            throw new NotFoundException(`Submission with ID ${submissionId} not found`);
        }

        // Update answer marks if provided
        if (gradeDto.answerMarks && gradeDto.answerMarks.length > 0) {
            for (const ans of gradeDto.answerMarks) {
                await this.prisma.submissionAnswer.update({
                    where: { id: ans.answerId },
                    data: { marksAwarded: ans.marksAwarded },
                });
            }
        }

        return this.prisma.homeworkSubmission.update({
            where: { id: submissionId },
            data: {
                totalMarksAwarded: gradeDto.totalMarksAwarded,
                feedback: gradeDto.feedback,
                status: SubmissionStatus.GRADED,
            },
            include: {
                answers: {
                    include: {
                        question: true,
                    },
                },
                homework: true,
                student: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            },
        });
    }
}
