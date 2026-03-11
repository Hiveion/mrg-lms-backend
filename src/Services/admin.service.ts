import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserByAdminDto, InviteUserDto, AssignClassDto } from '../DTOs/admin.dto';
import { UserStatus, UserRole, EnrollmentStatus, SessionStatus, WeekDay } from '@prisma/client';
import { MailService } from './mail.service';

import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        private jwtService: JwtService,
    ) { }

    async inviteUser(inviteUserDto: InviteUserDto) {
        // Enforce GMAIL MUST BE USED
        if (!inviteUserDto.email.toLowerCase().endsWith('@gmail.com')) {
            throw new ConflictException('Invitation is only allowed for Gmail addresses');
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { email: inviteUserDto.email },
        });

        if (existingUser && existingUser.status !== UserStatus.INCOMPLETE) {
            throw new ConflictException('User with this email already exists and is not pending setup');
        }

        // Set invitation expiry to 4 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 4);

        let user;
        if (existingUser) {
            // Update existing incomplete user
            user = await this.prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    userType: inviteUserDto.userType || existingUser.userType,
                    invitationExpiresAt: expiresAt,
                } as any,
            });
        } else {
            // Create new incomplete user
            user = await this.prisma.user.create({
                data: {
                    email: inviteUserDto.email,
                    firstName: '',
                    lastName: '',
                    userType: inviteUserDto.userType || null,
                    status: UserStatus.INCOMPLETE,
                    invitationExpiresAt: expiresAt,
                } as any,
            });
        }

        // Generate a 4-hour valid invitation token
        const tokenPayload = {
            email: user.email,
            role: user.userType,
            type: 'invitation',
        };
        const invitationToken = this.jwtService.sign(tokenPayload);

        // Send invitation email with token
        try {
            await this.mailService.sendUserInvitation(user.email, user.userType || undefined, invitationToken);
        } catch (error) {
            console.error('Failed to send invitation email:', error);
        }

        return {
            message: 'Invitation sent successfully. Valid for 4 hours.',
            email: user.email,
        };
    }

    async createUserByAdmin(createUserByAdminDto: CreateUserByAdminDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: createUserByAdminDto.email },
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(createUserByAdminDto.password, 10);

        // Even if admin creates, they might still want to follow the approval flow or set as active.
        // For now, let's keep it consistent with the self-registration flow for tutors and students.
        const status = (createUserByAdminDto.userType === UserRole.TUTOR || createUserByAdminDto.userType === UserRole.STUDENT)
            ? UserStatus.PENDING
            : UserStatus.ACTIVE;

        const user = await this.prisma.user.create({
            data: {
                email: createUserByAdminDto.email,
                passwordHash: hashedPassword,
                firstName: createUserByAdminDto.firstName,
                lastName: createUserByAdminDto.lastName,
                userType: createUserByAdminDto.userType,
                status: UserStatus.INCOMPLETE, // Start as incomplete to force profile setup
                mustChangePassword: true,
            },
        });

        // Send account creation email with temporary password
        try {
            await this.mailService.sendAdminCreatedAccount(
                user.email,
                createUserByAdminDto.password,
                user.userType as string,
            );
        } catch (error) {
            console.error('Failed to send account creation email:', error);
        }

        const { passwordHash, ...result } = user;
        return {
            message: 'User created successfully',
            user: result,
        };
    }

    async assignClass(dto: AssignClassDto) {
        const { studentId, tutorId, subjectId, schedule, startDate, numberOfWeeks = 4, grade, createSessions = true } = dto;

        // Verify entities exist
        const student = await this.prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
        const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
        const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });

        if (!student || !tutor || !subject) {
            throw new NotFoundException('Student, Tutor, or Subject not found');
        }

        const className = dto.name || `${subject.name} with ${student.user.firstName}`;

        return this.prisma.$transaction(async (tx) => {
            // 1. Create Class
            const newClass = await tx.class.create({
                data: {
                    name: className,
                    subjectId,
                    tutorId,
                    grade: grade || student.grade,
                    isActive: true,
                    isDemo: false,
                    frequency: dto.frequency || schedule.length,
                    maxStudentCount: dto.maxStudents || 20,
                    classFee: dto.baseFee || 0,
                    currentStudentCount: 1, // First student being enrolled
                    schedules: {
                        create: schedule.map(slot => ({
                            day: slot.day,
                            startTime: slot.startTime,
                            duration: slot.duration
                        }))
                    }
                }
            });

            // 2. Enroll Student
            await tx.enrollment.create({
                data: {
                    studentId,
                    classId: newClass.id,
                    status: EnrollmentStatus.ACTIVE,
                    assignedPrice: dto.studentPrice || dto.baseFee || 0,
                    confirmationDate: new Date(),
                }
            });

            // 3. Generate Sessions (Optional)
            if (createSessions) {
                const sessionData: any[] = [];
                const start = startDate ? new Date(startDate) : new Date();

                for (let i = 0; i < numberOfWeeks; i++) {
                    for (const slot of schedule) {
                        const sessionDate = this.getNextOccurrence(start, slot.day, i);
                        const [hours, minutes] = slot.startTime.split(':').map(Number);
                        sessionDate.setHours(hours, minutes, 0, 0);

                        sessionData.push({
                            classId: newClass.id,
                            dateTime: sessionDate,
                            duration: slot.duration,
                            status: SessionStatus.SCHEDULED,
                        });
                    }
                }

                if (sessionData.length > 0) {
                    await tx.session.createMany({
                        data: sessionData,
                    });
                }
            }

            // 4. Punch the class slot out of the tutor's and student's availability calendars
            for (const slot of schedule) {
                const classEnd = this.toTimeStr(this.toMinutes(slot.startTime) + slot.duration);
                await this.subtractFromTutorAvailability(tx, tutorId, slot.day as WeekDay, slot.startTime, classEnd);
                await this.subtractFromStudentAvailability(tx, studentId, slot.day as WeekDay, slot.startTime, classEnd);
            }

            return tx.class.findUnique({
                where: { id: newClass.id },
                include: {
                    subject: true,
                    tutor: { include: { user: true } },
                    sessions: true,
                    schedules: true,
                    enrollments: { include: { student: { include: { user: true } } } }
                }
            });
        });
    }

    async getMatchingSlots(tutorId: number, studentId: number) {
        const [tutorSlots, studentSlots] = await Promise.all([
            this.prisma.tutorAvailability.findMany({ where: { tutorId } }),
            this.prisma.studentAvailability.findMany({ where: { studentId } }),
        ]);

        const matchingSlots: {
            day: string;
            startTime: string;
            endTime: string;
            maxDuration: number;
        }[] = [];

        for (const tSlot of tutorSlots) {
            const tStart = this.toMinutes(tSlot.startTime);
            const tEnd = this.toMinutes(tSlot.endTime);

            for (const sSlot of studentSlots) {
                if (sSlot.day !== tSlot.day) continue;

                const sStart = this.toMinutes(sSlot.startTime);
                const sEnd = this.toMinutes(sSlot.endTime);

                // Compute overlap window
                const overlapStart = Math.max(tStart, sStart);
                const overlapEnd = Math.min(tEnd, sEnd);

                if (overlapEnd > overlapStart) {
                    matchingSlots.push({
                        day: tSlot.day,
                        startTime: this.toTimeStr(overlapStart),
                        endTime: this.toTimeStr(overlapEnd),
                        maxDuration: overlapEnd - overlapStart,
                    });
                }
            }
        }

        // Sort by day order then startTime
        const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
        matchingSlots.sort((a, b) => {
            const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            return dayDiff !== 0 ? dayDiff : this.toMinutes(a.startTime) - this.toMinutes(b.startTime);
        });

        return matchingSlots;
    }

    private getNextOccurrence(startDate: Date, targetDay: WeekDay, weekOffset: number): Date {
        const daysToIndex = {
            'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
        };
        const targetDayNum = daysToIndex[targetDay];
        const result = new Date(startDate);
        const currentDayNum = result.getDay();

        let diff = targetDayNum - currentDayNum;
        if (diff < 0) diff += 7;

        result.setDate(result.getDate() + diff + (weekOffset * 7));
        return result;
    }

    /** Convert "HH:MM" to total minutes */
    private toMinutes(time: string): number {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }

    /** Convert total minutes back to "HH:MM" */
    private toTimeStr(minutes: number): string {
        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    /**
     * Overlapping existing slots are deleted and the non-overlapping fragments re-created.
     */
    private async subtractFromTutorAvailability(
        tx: any,
        tutorId: number,
        day: WeekDay,
        classStart: string,
        classEnd: string,
    ): Promise<void> {
        const csMin = this.toMinutes(classStart);
        const ceMin = this.toMinutes(classEnd);

        const all = await tx.tutorAvailability.findMany({ where: { tutorId, day } });

        for (const slot of all) {
            const sStart = this.toMinutes(slot.startTime);
            const sEnd = this.toMinutes(slot.endTime);

            // Skip if no overlap
            if (sEnd <= csMin || sStart >= ceMin) continue;

            // Delete the original slot
            await tx.tutorAvailability.delete({ where: { id: slot.id } });

            // Re-create left fragment: [sStart, csMin) if it exists
            if (sStart < csMin) {
                await tx.tutorAvailability.create({
                    data: { tutorId, day, startTime: slot.startTime, endTime: classStart },
                });
            }

            // Re-create right fragment: [ceMin, sEnd) if it exists
            if (sEnd > ceMin) {
                await tx.tutorAvailability.create({
                    data: { tutorId, day, startTime: classEnd, endTime: slot.endTime },
                });
            }
            // If the class slot fully consumes the availability slot, it's just deleted — nothing to re-create.
        }
    }

    /**
     * Punch [classStart, classEnd) out of the student's availability on the given day.
     */
    private async subtractFromStudentAvailability(
        tx: any,
        studentId: number,
        day: WeekDay,
        classStart: string,
        classEnd: string,
    ): Promise<void> {
        const csMin = this.toMinutes(classStart);
        const ceMin = this.toMinutes(classEnd);

        const all = await tx.studentAvailability.findMany({ where: { studentId, day } });

        for (const slot of all) {
            const sStart = this.toMinutes(slot.startTime);
            const sEnd = this.toMinutes(slot.endTime);

            // Skip if no overlap
            if (sEnd <= csMin || sStart >= ceMin) continue;

            // Delete the original slot
            await tx.studentAvailability.delete({ where: { id: slot.id } });

            // Re-create left fragment: [sStart, csMin) if it exists
            if (sStart < csMin) {
                await tx.studentAvailability.create({
                    data: { studentId, day, startTime: slot.startTime, endTime: classStart },
                });
            }

            // Re-create right fragment: [ceMin, sEnd) if it exists
            if (sEnd > ceMin) {
                await tx.studentAvailability.create({
                    data: { studentId, day, startTime: classEnd, endTime: slot.endTime },
                });
            }
        }
    }

    async approveUser(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.status !== UserStatus.PENDING) {
            throw new ConflictException('User is not in PENDING status');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { status: UserStatus.ACTIVE },
        });

        // Send approval email
        try {
            await this.mailService.sendApprovalEmail(user.email, user.firstName);
        } catch (error) {
            console.error('Failed to send approval email:', error);
        }

        return {
            message: `User ${user.email} has been approved`,
            user: updatedUser,
        };
    }

    async rejectUser(userId: number, reason?: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // When rejecting, we can either delete or set to INACTIVE
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { status: UserStatus.INACTIVE },
        });

        // Send rejection email
        try {
            await this.mailService.sendRejectionEmail(user.email, user.firstName, reason);
        } catch (error) {
            console.error('Failed to send rejection email:', error);
        }

        return {
            message: `User ${user.email} has been rejected`,
            user: updatedUser,
        };
    }

    async findAllUsers() {
        const users = await this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                studentProfile: true,
                tutorProfile: true,
                parentProfile: true,
                coordinatorProfile: true,
            }
        });

        return users.map(user => {
            const { passwordHash, ...result } = user;
            return result;
        });
    }
}
