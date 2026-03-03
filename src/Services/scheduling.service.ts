import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { SetAvailabilityDto, UpdateAvailabilitySlotDto } from '../DTOs/scheduling.dto';
import { WeekDay } from '@prisma/client';

@Injectable()
export class SchedulingService {
    constructor(private prisma: PrismaService) { }

    async setTutorAvailability(userId: number, dto: SetAvailabilityDto) {
        const tutor = await this.prisma.tutor.findUnique({
            where: { userId },
        });

        if (!tutor) {
            throw new NotFoundException('Tutor profile not found');
        }

        // Replace existing availabilities
        return this.prisma.$transaction(async (tx) => {
            await tx.tutorAvailability.deleteMany({
                where: { tutorId: tutor.id },
            });

            return tx.tutorAvailability.createMany({
                data: dto.slots.map((slot) => ({
                    tutorId: tutor.id,
                    day: slot.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                })),
            });
        });
    }

    async updateTutorAvailabilitySlot(userId: number, slotId: number, dto: UpdateAvailabilitySlotDto) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
        if (!tutor) throw new NotFoundException('Tutor not found');

        const slot = await this.prisma.tutorAvailability.findFirst({
            where: { id: slotId, tutorId: tutor.id }
        });
        if (!slot) throw new NotFoundException('Availability slot not found or access denied');

        return this.prisma.tutorAvailability.update({
            where: { id: slotId },
            data: dto
        });
    }

    async deleteTutorAvailabilitySlot(userId: number, slotId: number) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
        if (!tutor) throw new NotFoundException('Tutor not found');

        const slot = await this.prisma.tutorAvailability.findFirst({
            where: { id: slotId, tutorId: tutor.id }
        });
        if (!slot) throw new NotFoundException('Availability slot not found or access denied');

        return this.prisma.tutorAvailability.delete({
            where: { id: slotId }
        });
    }

    async setStudentAvailability(userId: number, dto: SetAvailabilityDto) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            throw new NotFoundException('Student profile not found');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.studentAvailability.deleteMany({
                where: { studentId: student.id },
            });

            return tx.studentAvailability.createMany({
                data: dto.slots.map((slot) => ({
                    studentId: student.id,
                    day: slot.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                })),
            });
        });
    }

    async updateStudentAvailabilitySlot(userId: number, slotId: number, dto: UpdateAvailabilitySlotDto) {
        const student = await this.prisma.student.findUnique({ where: { userId } });
        if (!student) throw new NotFoundException('Student not found');

        const slot = await this.prisma.studentAvailability.findFirst({
            where: { id: slotId, studentId: student.id }
        });
        if (!slot) throw new NotFoundException('Availability slot not found or access denied');

        return this.prisma.studentAvailability.update({
            where: { id: slotId },
            data: dto
        });
    }

    async deleteStudentAvailabilitySlot(userId: number, slotId: number) {
        const student = await this.prisma.student.findUnique({ where: { userId } });
        if (!student) throw new NotFoundException('Student not found');

        const slot = await this.prisma.studentAvailability.findFirst({
            where: { id: slotId, studentId: student.id }
        });
        if (!slot) throw new NotFoundException('Availability slot not found or access denied');

        return this.prisma.studentAvailability.delete({
            where: { id: slotId }
        });
    }

    async getTutorAvailability(userId: number) {
        const tutor = await this.prisma.tutor.findUnique({
            where: { userId },
        });
        if (!tutor) throw new NotFoundException('Tutor not found');

        return this.prisma.tutorAvailability.findMany({
            where: { tutorId: tutor.id },
            orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
        });
    }

    async getStudentAvailability(userId: number) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });
        if (!student) throw new NotFoundException('Student not found');

        return this.prisma.studentAvailability.findMany({
            where: { studentId: student.id },
            orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
        });
    }

    async findOverlaps(tutorId: number, studentId: number) {
        const tutor = await this.prisma.tutor.findUnique({
            where: { id: tutorId },
            include: {
                availabilities: true,
                classes: {
                    include: {
                        subject: true
                    }
                }
            }
        });

        const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            include: { availabilities: true }
        });

        if (!tutor || !student) throw new NotFoundException('Tutor or Student not found');

        const overlaps = this.calculateOverlapsInternal(tutor.availabilities, student.availabilities);

        return {
            tutorClasses: tutor.classes,
            overlaps
        };
    }

    async getMatchedStudentsForTutor(userId: number) {
        const tutor = await this.prisma.tutor.findUnique({
            where: { userId },
            include: {
                availabilities: true,
                classes: {
                    include: {
                        subject: true,
                    },
                },
            },
        });

        if (!tutor) throw new NotFoundException('Tutor profile not found');

        const allStudents = await this.prisma.student.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profilePicture: true,
                    },
                },
                availabilities: true,
            },
        });

        const matchedStudents = allStudents
            .map((student) => {
                const overlaps = this.calculateOverlapsInternal(tutor.availabilities, student.availabilities);
                if (overlaps.length > 0) {
                    return {
                        studentId: student.id,
                        user: student.user,
                        grade: student.grade,
                        overlaps,
                    };
                }
                return null;
            })
            .filter(Boolean);

        return {
            tutorClasses: tutor.classes,
            matchedStudents,
        };
    }

    async getMatchedTutorsForStudent(userId: number) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
            include: { availabilities: true },
        });

        if (!student) throw new NotFoundException('Student profile not found');

        const allTutors = await this.prisma.tutor.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profilePicture: true,
                    },
                },
                availabilities: true,
                classes: {
                    include: {
                        subject: true,
                    },
                },
            },
        });

        const matchedTutors = allTutors
            .map((tutor) => {
                const overlaps = this.calculateOverlapsInternal(tutor.availabilities, student.availabilities);
                if (overlaps.length > 0) {
                    return {
                        tutorId: tutor.id,
                        user: tutor.user,
                        bio: tutor.bio,
                        qualifications: tutor.qualifications,
                        averageRating: tutor.averageRating,
                        classes: tutor.classes,
                        overlaps,
                    };
                }
                return null;
            })
            .filter(Boolean);

        return matchedTutors;
    }

    private calculateOverlapsInternal(tutorAvail: any[], studentAvail: any[]) {
        const overlaps: { day: WeekDay; startTime: string; endTime: string }[] = [];

        for (const t of tutorAvail) {
            for (const s of studentAvail) {
                if (t.day === s.day) {
                    const overlap = this.calculateOverlap(
                        t.startTime,
                        t.endTime,
                        s.startTime,
                        s.endTime,
                    );
                    if (overlap) {
                        overlaps.push({
                            day: t.day,
                            startTime: overlap.start,
                            endTime: overlap.end,
                        });
                    }
                }
            }
        }

        return overlaps;
    }

    private calculateOverlap(start1: string, end1: string, start2: string, end2: string) {
        const s1 = this.timeToMinutes(start1);
        const e1 = this.timeToMinutes(end1);
        const s2 = this.timeToMinutes(start2);
        const e2 = this.timeToMinutes(end2);

        const overlapStart = Math.max(s1, s2);
        const overlapEnd = Math.min(e1, e2);

        if (overlapStart < overlapEnd) {
            return {
                start: this.minutesToTime(overlapStart),
                end: this.minutesToTime(overlapEnd),
            };
        }
        return null;
    }

    private timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    private minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
}
