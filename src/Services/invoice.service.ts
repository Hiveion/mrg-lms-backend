import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { InvoiceStatus, EnrollmentStatus } from '@prisma/client';
import { UpdateInvoiceDto } from '../DTOs/invoice.dto';

@Injectable()
export class InvoiceService {
    constructor(private prisma: PrismaService) { }

    /**
     * Automatically generate invoices for all students with active enrollments for a specific month.
     */
    async generateInvoices(month: string) {
        // 1. Find all active enrollments with their assigned prices and subject/class info
        const activeEnrollments = await this.prisma.enrollment.findMany({
            where: { status: EnrollmentStatus.ACTIVE },
            include: {
                student: {
                    include: {
                        user: true,
                    },
                },
                class: {
                    include: {
                        subject: true,
                    },
                },
            },
        });

        if (activeEnrollments.length === 0) {
            return { message: 'No active enrollments found for invoice generation.', count: 0 };
        }

        // 2. Group enrollments by studentId
        const studentEnrollmentsMap = new Map<number, any[]>();
        for (const enrollment of activeEnrollments) {
            const list = studentEnrollmentsMap.get(enrollment.studentId) || [];
            list.push(enrollment);
            studentEnrollmentsMap.set(enrollment.studentId, list);
        }

        let createdInvoicesCount = 0;
        let skippedInvoicesCount = 0;

        const results: any[] = [];

        // 3. Process each student grouping
        for (const [studentId, enrollments] of studentEnrollmentsMap.entries()) {
            // Check if invoice already exists for this student and month
            const existingInvoice = await this.prisma.invoice.findFirst({
                where: { studentId, month },
            });

            if (existingInvoice) {
                skippedInvoicesCount++;
                continue;
            }

            // Calculate totals
            const subtotal = enrollments.reduce((sum, e) => sum + e.assignedPrice, 0);
            const total = subtotal; // Assume no discount at generation

            // Set due date to 15th of the month
            const [year, monthStr] = month.split('-').map(Number);
            const dueDate = new Date(year, monthStr - 1, 15);

            // Create Invoice and items in a transaction
            const newInvoice = await this.prisma.invoice.create({
                data: {
                    studentId,
                    month,
                    subtotal,
                    discount: 0.0,
                    additionalPayment: 0.0,
                    total: subtotal,
                    status: InvoiceStatus.DRAFT,
                    dueDate,
                    items: {
                        create: enrollments.map(e => ({
                            classId: e.classId,
                            description: `${e.class.subject.name} (${e.class.grade || 'Default'})`,
                            amount: e.assignedPrice,
                        })),
                    },
                },
                include: {
                    items: true,
                },
            });

            results.push(newInvoice);
            createdInvoicesCount++;
        }

        return {
            message: `Invoice generation complete.`,
            generated: createdInvoicesCount,
            skipped: skippedInvoicesCount,
            month,
        };
    }

    async findAll(studentId?: number, month?: string, status?: InvoiceStatus) {
        return this.prisma.invoice.findMany({
            where: {
                ...(studentId && { studentId }),
                ...(month && { month }),
                ...(status && { status }),
            },
            include: {
                student: {
                    include: {
                        user: true,
                    },
                },
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: number) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: {
                student: {
                    include: {
                        user: true,
                    },
                },
                items: {
                    include: {
                        class: {
                            include: {
                                subject: true,
                            },
                        },
                    },
                },
                payments: true,
            },
        });

        if (!invoice) {
            throw new NotFoundException(`Invoice with ID ${id} not found.`);
        }

        return invoice;
    }

    async updateStatus(id: number, status: InvoiceStatus) {
        const invoice = await this.prisma.invoice.findUnique({ where: { id } });
        if (!invoice) throw new NotFoundException('Invoice not found');

        const updateData: any = { status };
        if (status === InvoiceStatus.PAID) {
            updateData.paidDate = new Date();
        }

        return this.prisma.invoice.update({
            where: { id },
            data: updateData,
        });
    }

    async updateInvoice(id: number, updateDto: UpdateInvoiceDto) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!invoice) throw new NotFoundException('Invoice not found');

        if (invoice.status !== InvoiceStatus.DRAFT && (updateDto.items || updateDto.discount !== undefined || updateDto.additionalPayment !== undefined)) {
            throw new ConflictException('Can only edit items, discounts, and additional payments of DRAFT invoices');
        }

        const data: any = { ...updateDto };
        delete data.items;

        return this.prisma.$transaction(async (tx) => {
            // Update items if provided
            if (updateDto.items) {
                // Delete existing items
                await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

                // Create new items
                await tx.invoiceItem.createMany({
                    data: updateDto.items.map(item => ({
                        invoiceId: id,
                        classId: item.classId,
                        description: item.description,
                        amount: item.amount,
                    })),
                });

                // Calculate subtotal
                const subtotal = updateDto.items.reduce((sum, item) => sum + item.amount, 0);
                data.subtotal = subtotal;
            }

            // Recalculate total
            if (updateDto.items || updateDto.discount !== undefined || updateDto.additionalPayment !== undefined) {
                const subtotal = data.subtotal !== undefined ? data.subtotal : invoice.subtotal;
                const discount = updateDto.discount !== undefined ? updateDto.discount : invoice.discount;
                const additionalPayment = updateDto.additionalPayment !== undefined ? updateDto.additionalPayment : invoice.additionalPayment;
                data.total = Math.max(0, subtotal - discount + additionalPayment);
            }

            return tx.invoice.update({
                where: { id },
                data,
                include: { items: true },
            });
        });
    }

    async deleteInvoice(id: number) {
        const invoice = await this.prisma.invoice.findUnique({ where: { id } });
        if (!invoice) throw new NotFoundException('Invoice not found');

        if (invoice.status === InvoiceStatus.PAID) {
            throw new ConflictException('Cannot delete a paid invoice');
        }

        return this.prisma.invoice.delete({ where: { id } });
    }

    async findParentInvoices(parentId: number) {
        // Get children
        const parent = await this.prisma.parent.findUnique({
            where: { id: parentId },
            include: { students: { select: { studentId: true } } },
        });

        if (!parent) return [];

        const childrenIds = parent.students.map(s => s.studentId);

        return this.prisma.invoice.findMany({
            where: {
                studentId: { in: childrenIds },
            },
            include: {
                student: {
                    include: {
                        user: true,
                    },
                },
                items: true,
            },
            orderBy: { dueDate: 'desc' },
        });
    }
}
