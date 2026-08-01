import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async getAdminStats() {
        const totalStudents = await this.prisma.student.count();
        const totalTutors = await this.prisma.tutor.count();
        const activeClasses = await this.prisma.class.count({
            where: { isActive: true }
        });

        // Current month range
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59, 999);

        // Monthly revenue
        const paidInvoices = await this.prisma.invoice.findMany({
            where: {
                status: 'PAID',
                paidDate: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            select: { total: true }
        });
        const revenueSum = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        // Pending approvals
        const pendingApprovalsList = await this.prisma.user.findMany({
            where: { status: 'PENDING' },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                userType: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Pending payments
        const pendingPaymentsCount = await this.prisma.invoice.count({
            where: {
                status: { in: ['SENT', 'OVERDUE'] }
            }
        });

        return {
            totalStudents,
            totalTutors,
            activeClasses,
            monthlyRevenue: `LKR ${revenueSum.toLocaleString()}`,
            pendingApprovals: pendingApprovalsList,
            pendingPayments: pendingPaymentsCount
        };
    }

    async getTutorStats(userId: number) {
        const tutor = await this.prisma.tutor.findUnique({
            where: { userId },
            include: {
                availabilities: true
            }
        });
        if (!tutor) {
            throw new NotFoundException('Tutor profile not found');
        }

        // Ratings & reviews
        const rating = tutor.averageRating || 0.0;
        const totalReviews = tutor.totalReviews || 0;

        // Get active classes details
        const classes = await this.prisma.class.findMany({
            where: { tutorId: tutor.id, isActive: true },
            include: { subject: true }
        });
        const subjects = Array.from(new Set(classes.map(c => c.subject.name)));

        const activeClassesDetails = classes.map(c => ({
            id: c.id,
            name: c.name,
            subject: c.subject.name,
            grade: c.grade || 'N/A',
            studentCount: c.currentStudentCount,
            hourlyRate: c.tutorHourlyRate ?? tutor.hourlyRate ?? 0
        }));

        // Calculate total students sum from classes
        const assignedStudentsCount = classes.reduce((sum, c) => sum + (c.currentStudentCount || 0), 0);

        // Get availability slots
        const availability = tutor.availabilities.map(slot => ({
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime
        }));

        return {
            assignedStudentsCount,
            rating,
            totalReviews,
            classesCount: classes.length,
            availability,
            subjects,
            classes: activeClassesDetails
        };
    }

    async getStudentStats(userId: number) {
        const student = await this.prisma.student.findUnique({
            where: { userId }
        });
        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        // Enrolled classes count
        const enrolledClassesCount = await this.prisma.enrollment.count({
            where: {
                studentId: student.id,
                status: 'ACTIVE'
            }
        });

        // Week range
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Classes this week
        const classesThisWeekCount = await this.prisma.session.count({
            where: {
                class: { enrollments: { some: { studentId: student.id, status: 'ACTIVE' } } },
                dateTime: {
                    gte: startOfWeek,
                    lte: endOfWeek
                }
            }
        });

        // Classes remaining
        const classesRemainingCount = await this.prisma.session.count({
            where: {
                class: { enrollments: { some: { studentId: student.id, status: 'ACTIVE' } } },
                status: 'SCHEDULED',
                dateTime: {
                    gte: now,
                    lte: endOfWeek
                }
            }
        });

        // Pending homework
        const totalHomework = await this.prisma.homework.findMany({
            where: {
                class: { enrollments: { some: { studentId: student.id, status: 'ACTIVE' } } }
            },
            include: {
                submissions: {
                    where: { studentId: student.id }
                },
                class: {
                    include: { subject: true }
                }
            }
        });

        const pendingHomeworkList = totalHomework
            .filter(hw => hw.submissions.length === 0)
            .map(hw => ({
                id: hw.id,
                subject: hw.class.subject.name,
                title: hw.title,
                dueDate: hw.deadlineDate ? hw.deadlineDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Deadline'
            }));

        // Latest unpaid invoice
        const latestInvoice = await this.prisma.invoice.findFirst({
            where: {
                studentId: student.id,
                status: { in: ['SENT', 'OVERDUE'] }
            },
            orderBy: { dueDate: 'asc' }
        });

        const paymentStatus = {
            isPaid: !latestInvoice,
            dueDate: latestInvoice ? latestInvoice.dueDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            amount: latestInvoice ? `LKR ${latestInvoice.total.toLocaleString()}` : ''
        };

        return {
            enrolledClassesCount,
            classesThisWeek: classesThisWeekCount,
            classesRemaining: classesRemainingCount,
            pendingHomeworkCount: pendingHomeworkList.length,
            pendingHomework: pendingHomeworkList,
            paymentStatus,
            attendance: 95 // Default solid attendance metric
        };
    }
}
