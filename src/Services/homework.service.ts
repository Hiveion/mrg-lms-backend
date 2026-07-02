import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateHomeworkDto, CreateHomeworkSubmissionDto, GradeSubmissionDto } from '../DTOs/homework.dto';
import { HomeworkType, SubmissionStatus, EnrollmentStatus, UserRole } from '@prisma/client';
import { GoogleService } from './google.service';

@Injectable()
export class HomeworkService {
    constructor(
        private prisma: PrismaService,
        private googleService: GoogleService,
    ) { }

    async create(createHomeworkDto: CreateHomeworkDto, callerId?: number, callerRole?: string, file?: any) {
        const { questions, ...homeworkData } = createHomeworkDto;

        // Validate class exists
        const classItem = await this.prisma.class.findUnique({
            where: { id: homeworkData.classId },
            include: { tutor: { select: { userId: true } } },
        });
        if (!classItem) {
            throw new NotFoundException(`Class with ID ${homeworkData.classId} not found`);
        }

        // Tutors can only create homework for their own classes
        if (callerRole && callerRole.toUpperCase() === UserRole.TUTOR) {
            if (classItem.tutor.userId !== callerId) {
                throw new ForbiddenException('You can only create homework for your own classes');
            }
        }

        // Business Logic Validation
        if (homeworkData.type === HomeworkType.QUIZ && (!questions || questions.length === 0)) {
            throw new BadRequestException('Quiz type homework must have at least one question');
        }

        if (homeworkData.type === HomeworkType.FILE && !homeworkData.fileUrl && !file) {
            throw new BadRequestException('File type homework must have a file URL or file upload');
        }

        let fileUrl = homeworkData.fileUrl;
        if (file) {
            const uploadResult = await this.googleService.uploadFile(callerId || 0, file, 'assignments');
            if (uploadResult) {
                fileUrl = uploadResult.webViewLink;
            }
        }

        return this.prisma.homework.create({
            data: {
                ...homeworkData,
                fileUrl,
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

    async getClassesForHomework(userId: number, userRole: string) {
        const role = userRole?.toUpperCase();

        // Admins and coordinators can assign homework to any active class
        if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
            return this.prisma.class.findMany({
                where: { isActive: true },
                include: {
                    subject: true,
                    tutor: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { name: 'asc' },
            });
        }

        // Tutors can only assign homework to their own classes
        return this.prisma.class.findMany({
            where: {
                isActive: true,
                tutor: { userId },
            },
            include: {
                subject: true,
                tutor: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
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
                            status: EnrollmentStatus.ACTIVE,
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

    async findByTutorUserId(userId: number) {
        return this.prisma.homework.findMany({
            where: {
                class: {
                    tutor: {
                        userId: userId,
                    },
                },
            },
            include: {
                class: {
                    include: {
                        subject: true,
                    },
                },
                questions: true,
                _count: {
                    select: { submissions: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findTutorPendingSubmissions(userId: number) {
        return this.prisma.homeworkSubmission.findMany({
            where: {
                homework: {
                    class: {
                        tutor: {
                            userId: userId,
                        },
                    },
                },
                status: {
                    in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE],
                },
            },
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
                        question: {
                            select: {
                                id: true,
                                questionText: true,
                                questionType: true,
                                marks: true,
                                correctAnswer: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                submittedAt: 'desc',
            },
        });
    }

    async findTutorGradedSubmissions(userId: number) {
        return this.prisma.homeworkSubmission.findMany({
            where: {
                homework: {
                    class: {
                        tutor: {
                            userId: userId,
                        },
                    },
                },
                status: SubmissionStatus.GRADED,
            },
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
                        question: {
                            select: {
                                id: true,
                                questionText: true,
                                questionType: true,
                                marks: true,
                                correctAnswer: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    }

    async findAllPendingSubmissions() {
        return this.prisma.homeworkSubmission.findMany({
            where: {
                status: {
                    in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE],
                },
            },
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
                homework: {
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
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                answers: {
                    include: {
                        question: {
                            select: {
                                id: true,
                                questionText: true,
                                questionType: true,
                                marks: true,
                                correctAnswer: true,
                            },
                        },
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async findAllGradedSubmissions() {
        return this.prisma.homeworkSubmission.findMany({
            where: { status: SubmissionStatus.GRADED },
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
                homework: {
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
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                answers: {
                    include: {
                        question: {
                            select: {
                                id: true,
                                questionText: true,
                                questionType: true,
                                marks: true,
                                correctAnswer: true,
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async submit(userId: number, submissionDto: CreateHomeworkSubmissionDto, file?: any) {
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

        if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
            throw new BadRequestException('Student does not have an active enrollment in this class');
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

        let submissionFileUrl = submissionDto.submissionFileUrl;
        if (file) {
            const uploadResult = await this.googleService.uploadFile(userId, file, 'submissions');
            if (uploadResult) {
                submissionFileUrl = uploadResult.webViewLink;
            }
        }

        return this.prisma.homeworkSubmission.create({
            data: {
                homeworkId: homework.id,
                studentId: student.id,
                status,
                submissionFileUrl,
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

    async grade(tutorUserId: number, submissionId: number, gradeDto: GradeSubmissionDto) {
        const submission = await this.prisma.homeworkSubmission.findUnique({
            where: { id: submissionId },
            include: {
                homework: {
                    include: {
                        class: {
                            select: {
                                tutor: {
                                    select: { userId: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!submission) {
            throw new NotFoundException(`Submission with ID ${submissionId} not found`);
        }

        if (submission.homework.class.tutor.userId !== tutorUserId) {
            throw new BadRequestException('You are not the tutor for this class');
        }

        return this.prisma.$transaction(async (tx) => {
            // Update individual answer marks if provided
            if (gradeDto.answerMarks && gradeDto.answerMarks.length > 0) {
                for (const ans of gradeDto.answerMarks) {
                    await tx.submissionAnswer.update({
                        where: { id: ans.answerId },
                        data: { marksAwarded: ans.marksAwarded },
                    });
                }
            }

            // Update main submission
            return tx.homeworkSubmission.update({
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
                    homework: {
                        include: {
                            class: {
                                include: {
                                    subject: true
                                }
                            }
                        }
                    },
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
        });
    }
}
