import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserByAdminDto, InviteUserDto, AssignClassDto } from '../DTOs/admin.dto';
import { UserStatus, UserRole, EnrollmentStatus, SessionStatus, WeekDay } from '@prisma/client';
import { MailService } from './mail.service';

import { JwtService } from '@nestjs/jwt';
import { GoogleService } from './google.service';

const dayToNum: Record<string, number> = {
    'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
};

const numToDay: Record<number, string> = {
    0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY'
};

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        private jwtService: JwtService,
        private googleService: GoogleService,
    ) { }

    async findAllTutors() {
        return this.prisma.tutor.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        profilePicture: true,
                        phoneNumber: true,
                        timezone: true,
                    },
                },
                classes: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        grade: true,
                        classFee: true,
                        subject: {
                            select: { name: true },
                        },
                    },
                },
                ratings: {
                    select: {
                        id: true,
                        overallRating: true,
                        teachingQuality: true,
                        communication: true,
                        punctuality: true,
                        review: true,
                        likes: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { averageRating: 'desc' },
        });
    }

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

    async assignClass(dto: AssignClassDto, adminId: number) {
        const { tutorId, subjectId, schedule, startDate, numberOfWeeks = 4, grade, createSessions = true } = dto;

        // Support both studentId and studentIds for backward compatibility
        const studentIds = dto.studentIds || (dto.studentId ? [dto.studentId] : []);
        if (studentIds.length === 0) {
            throw new NotFoundException('At least one student must be specified');
        }

        // Verify entities exist
        const students = await this.prisma.student.findMany({
            where: { id: { in: studentIds } },
            include: { user: true }
        });

        if (students.length !== studentIds.length) {
            throw new NotFoundException('One or more students not found');
        }

        const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
        const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });

        if (!tutor || !subject) {
            throw new NotFoundException('Tutor or Subject not found');
        }

        const className = dto.name || `${subject.name} - ${tutor.user.firstName}`;

        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Create Class
            const newClass = await tx.class.create({
                data: {
                    name: className,
                    subjectId,
                    tutorId,
                    grade: grade || students[0].grade, // Use first student's grade if not provided
                    isActive: true,
                    isDemo: false,
                    frequency: dto.frequency || schedule.length,
                    maxStudentCount: dto.maxStudents || 20,
                    classFee: dto.baseFee || 0,
                    currentStudentCount: students.length,
                    schedules: {
                        create: schedule.map(slot => ({
                            day: slot.day,
                            startTime: slot.startTime,
                            duration: slot.duration
                        }))
                    }
                }
            });

            // 2. Enroll All Students
            await tx.enrollment.createMany({
                data: students.map(student => ({
                    studentId: student.id,
                    classId: newClass.id,
                    status: EnrollmentStatus.ACTIVE,
                    assignedPrice: dto.studentPrice || dto.baseFee || 0,
                    confirmationDate: new Date(),
                }))
            });

            // 3. Generate Sessions (Optional)
            if (createSessions) {
                const sessionData: any[] = [];
                let start: Date;
                if (startDate) {
                    start = new Date(`${startDate}T00:00:00Z`);
                } else {
                    start = new Date();
                }

                for (let i = 0; i < numberOfWeeks; i++) {
                    for (const slot of schedule) {
                        const sessionDate = this.getNextOccurrenceUTC(start, slot.day as WeekDay, i);
                        const [hours, minutes] = slot.startTime.split(':').map(Number);
                        sessionDate.setUTCHours(hours, minutes, 0, 0);

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

            // 4. Punch the class slot out of the tutor's and students' availability calendars
            for (const slot of schedule) {
                const segments = this.getUtcSegments(slot.day as WeekDay, slot.startTime, slot.duration);
                for (const segment of segments) {
                    await this.subtractFromTutorAvailability(tx, tutorId, segment.day, segment.start, segment.end);
                    for (const student of students) {
                        await this.subtractFromStudentAvailability(tx, student.id, segment.day, segment.start, segment.end);
                    }
                }
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

        // 5. Create Google Calendar events and Meet links
        if (result && result.sessions.length > 0) {
            const studentEmails = students.map(s => s.user.email);
            const tutorEmail = tutor.user.email;

            for (const session of result.sessions) {
                const sessionWithClass = {
                    ...session,
                    class: {
                        name: result.name,
                        subject: { name: result.subject.name }
                    }
                };
                await this.googleService.createCalendarEvent(
                    adminId,
                    sessionWithClass,
                    studentEmails,
                    tutorEmail
                );
            }
        }

        return result;
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
        const targetDayNum = dayToNum[targetDay];
        const result = new Date(startDate);
        const currentDayNum = result.getDay();

        let diff = targetDayNum - currentDayNum;
        if (diff < 0) diff += 7;

        result.setDate(result.getDate() + diff + (weekOffset * 7));
        return result;
    }

    private getNextOccurrenceUTC(startDate: Date, targetDay: WeekDay, weekOffset: number): Date {
        const targetDayNum = dayToNum[targetDay];
        const result = new Date(startDate.getTime());
        const currentDayNum = result.getUTCDay();

        let diff = targetDayNum - currentDayNum;
        if (diff < 0) diff += 7;

        result.setUTCDate(result.getUTCDate() + diff + (weekOffset * 7));
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

    private getUtcSegments(day: WeekDay, startTime: string, duration: number) {
        const startMins = dayToNum[day] * 1440 + this.toMinutes(startTime);
        const endMins = startMins + duration;

        const segments: { day: WeekDay; start: string; end: string }[] = [];
        let cursor = startMins;
        while (cursor < endMins) {
            const dayIdx = Math.floor(cursor / 1440) % 7;
            const dayEnd = (dayIdx + 1) * 1440;
            const segmentEnd = Math.min(endMins, dayEnd);

            segments.push({
                day: numToDay[dayIdx] as WeekDay,
                start: this.toTimeStr(cursor - dayIdx * 1440),
                end: segmentEnd === dayEnd ? '00:00' : this.toTimeStr(segmentEnd - dayIdx * 1440),
            });

            cursor = segmentEnd;
        }
        return segments;
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
        const ceMin = classEnd === '00:00' ? 1440 : this.toMinutes(classEnd);

        const all = await tx.tutorAvailability.findMany({ where: { tutorId, day } });

        for (const slot of all) {
            const sStart = this.toMinutes(slot.startTime);
            const sEnd = slot.endTime === '00:00' ? 1440 : this.toMinutes(slot.endTime);

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
        const ceMin = classEnd === '00:00' ? 1440 : this.toMinutes(classEnd);

        const all = await tx.studentAvailability.findMany({ where: { studentId, day } });

        for (const slot of all) {
            const sStart = this.toMinutes(slot.startTime);
            const sEnd = slot.endTime === '00:00' ? 1440 : this.toMinutes(slot.endTime);

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

    async sendAnnouncementToAllUsers(title: string, message: string) {
        const users = await this.prisma.user.findMany({
            where: {
                status: 'ACTIVE'
            },
            select: { id: true }
        });

        const data = users.map(user => ({
            userId: user.id,
            title,
            message,
            type: 'ANNOUNCEMENT' as any,
        }));

        if (data.length > 0) {
            await this.prisma.notification.createMany({
                data,
            });
        }

        return { success: true, count: data.length };
    }

    async deleteAnnouncement(adminNotifId: number) {
        const notif = await this.prisma.notification.findUnique({ where: { id: adminNotifId } });
        if (!notif) throw new NotFoundException('Announcement not found');

        // We calculate a 2-minute time window around createdAt to safely delete all instances of this broadcast
        const windowStart = new Date(notif.createdAt.getTime() - 120000);
        const windowEnd = new Date(notif.createdAt.getTime() + 120000);

        const result = await this.prisma.notification.deleteMany({
            where: {
                title: notif.title,
                message: notif.message,
                type: 'ANNOUNCEMENT' as any,
                createdAt: {
                    gte: windowStart,
                    lte: windowEnd
                }
            }
        });

        return { success: true, deletedCount: result.count };
    }

    async updateAnnouncement(adminNotifId: number, title: string, message: string) {
        const notif = await this.prisma.notification.findUnique({ where: { id: adminNotifId } });
        if (!notif) throw new NotFoundException('Announcement not found');

        const windowStart = new Date(notif.createdAt.getTime() - 120000);
        const windowEnd = new Date(notif.createdAt.getTime() + 120000);

        const result = await this.prisma.notification.updateMany({
            where: {
                title: notif.title,
                message: notif.message,
                type: 'ANNOUNCEMENT' as any,
                createdAt: {
                    gte: windowStart,
                    lte: windowEnd
                }
            },
            data: { title, message }
        });

        return { success: true, updatedCount: result.count };
    }
}
