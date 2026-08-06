import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserByAdminDto, InviteUserDto, AssignClassDto, UpdateUserByAdminDto, ClassScheduleDto } from '../DTOs/admin.dto';
import { RequestClassDto, ApproveClassRequestDto } from '../DTOs/class-request.dto';
import { UserStatus, UserRole, EnrollmentStatus, SessionStatus, WeekDay, ClassRequestStatus, NotificationType } from '@prisma/client';
import { MailService } from './mail.service';
import { NotificationService } from './notification.service';

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
        private notificationService: NotificationService,
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
                        studentRateAmount: true,
                        studentRateCurrency: true,
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
            // Create new incomplete user. Email is unique at the DB level, so a concurrent
            // invite for the same address racing past the check above lands here as a clean
            // P2002 instead of an unhandled 500.
            try {
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
            } catch (error: any) {
                if (error.code === 'P2002') {
                    throw new ConflictException('An invitation for this email is already being processed, please retry');
                }
                throw error;
            }
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

        // Email is unique at the DB level, so a concurrent create for the same address racing
        // past the check above lands here as a clean P2002 instead of an unhandled 500.
        let user;
        try {
            user = await this.prisma.user.create({
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
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new ConflictException('User with this email already exists');
            }
            throw error;
        }

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
        // Support both studentId and studentIds for backward compatibility
        const studentIds = dto.studentIds || (dto.studentId ? [dto.studentId] : []);

        return this.materializeClass({
            tutorId: dto.tutorId,
            subjectId: dto.subjectId,
            studentIds,
            name: dto.name,
            grade: dto.grade,
            schedule: dto.schedule,
            startDate: dto.startDate,
            frequency: dto.frequency,
            numberOfWeeks: dto.numberOfWeeks,
            createSessions: dto.createSessions,
            studentRateAmount: dto.studentRateAmount,
            studentRateCurrency: dto.studentRateCurrency,
            studentPriceAmount: dto.studentPriceAmount,
            studentPriceCurrency: dto.studentPriceCurrency,
            tutorHourlyRate: dto.tutorHourlyRate,
            tutorRateCurrency: dto.tutorRateCurrency,
            adminId,
        });
    }

    /**
     * Creates the Class + ClassSchedule(s), enrolls the given students (ACTIVE, priced),
     * optionally generates Sessions, punches the slot out of tutor/student availability, and
     * sends calendar invites. Shared by the direct admin/coordinator `assignClass` flow and by
     * `approveClassRequest`, which calls this only once both fees have been set by an admin.
     */
    private async materializeClass(params: {
        tutorId: number;
        subjectId: number;
        studentIds: number[];
        name?: string;
        grade?: string;
        schedule: ClassScheduleDto[];
        startDate?: string;
        frequency?: number;
        numberOfWeeks?: number;
        createSessions?: boolean;
        studentRateAmount?: number;
        studentRateCurrency?: string;
        studentPriceAmount?: number;
        studentPriceCurrency?: string;
        tutorHourlyRate?: number;
        tutorRateCurrency?: string;
        adminId: number;
    }) {
        const {
            tutorId, subjectId, studentIds, schedule, startDate,
            numberOfWeeks = 4, grade, createSessions = true, adminId,
        } = params;

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

        const className = params.name || `${subject.name} - ${tutor.user.firstName}`;

        // Two admins assigning overlapping-schedule classes at the same time can cause this
        // transaction to fail (e.g. a competing transaction already modified/deleted the same
        // availability row this one is trying to punch out — surfaces as P2025). Postgres
        // rolls the whole transaction back cleanly in that case (no partial/corrupted writes),
        // so the only thing to fix here is surfacing a clean, retryable error instead of a
        // raw unhandled 500.
        let result;
        try {
            result = await this.prisma.$transaction(async (tx) => {
            // 1. Create Class
            const newClass = await tx.class.create({
                data: {
                    name: className,
                    subjectId,
                    tutorId,
                    grade: grade || students[0].grade, // Use first student's grade if not provided
                    isActive: true,
                    isDemo: false,
                    frequency: params.frequency || schedule.length,
                    studentRateAmount: params.studentRateAmount,
                    studentRateCurrency: params.studentRateCurrency,
                    tutorHourlyRate: params.tutorHourlyRate,
                    tutorRateCurrency: params.tutorRateCurrency,
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
            // An explicit studentPriceAmount/Currency override applies uniformly to every
            // student in the batch; otherwise each student's amount falls back to the
            // class's advertised student rate, but currency always follows that specific
            // student's own currency (no conversion between the two).
            await tx.enrollment.createMany({
                data: students.map(student => ({
                    studentId: student.id,
                    classId: newClass.id,
                    status: EnrollmentStatus.ACTIVE,
                    assignedPrice: params.studentPriceAmount ?? params.studentRateAmount ?? 0,
                    priceCurrency: params.studentPriceCurrency ?? student.currency,
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
        } catch (error: any) {
            if (error.code === 'P2025' || error.code === 'P2002') {
                throw new ConflictException('This time slot was just modified by another request — please retry');
            }
            throw error;
        }

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

    /**
     * Tutor-submitted request for a new class. Deliberately never sets a fee — no
     * Class/Enrollment/Session rows are created until an admin/coordinator approves the
     * request via `approveClassRequest`.
     */
    async createClassRequest(dto: RequestClassDto, tutorUserId: number) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId: tutorUserId } });
        if (!tutor) {
            throw new NotFoundException('Tutor profile not found');
        }

        const studentIds = dto.studentIds || (dto.studentId ? [dto.studentId] : []);
        if (studentIds.length === 0) {
            throw new NotFoundException('At least one student must be specified');
        }

        const [students, subject] = await Promise.all([
            this.prisma.student.findMany({ where: { id: { in: studentIds } } }),
            this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
        ]);
        if (students.length !== studentIds.length) {
            throw new NotFoundException('One or more students not found');
        }
        if (!subject) {
            throw new NotFoundException(`Subject with ID ${dto.subjectId} not found`);
        }

        return this.prisma.classRequest.create({
            data: {
                tutorId: tutor.id,
                subjectId: dto.subjectId,
                name: dto.name,
                grade: dto.grade,
                studentIds,
                schedule: dto.schedule as any,
                startDate: dto.startDate,
                frequency: dto.frequency,
                numberOfWeeks: dto.numberOfWeeks,
                createSessions: dto.createSessions ?? true,
            },
            include: { subject: true },
        });
    }

    async listClassRequests(status?: ClassRequestStatus) {
        const requests = await this.prisma.classRequest.findMany({
            where: status ? { status } : undefined,
            include: {
                // tutor.hourlyRate/tutor.currency double as the tutor's default rate/currency,
                // shown to the admin as a starting point before they set the per-class fee.
                tutor: { include: { user: true } },
                subject: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // studentIds is a bare Int[] (not a Prisma relation), so it isn't resolvable via
        // `include` — batch-fetch every referenced student once across all requests so the
        // admin can see each student's billing currency before setting studentRateCurrency.
        const allStudentIds = [...new Set(requests.flatMap(r => r.studentIds))];
        const students = allStudentIds.length
            ? await this.prisma.student.findMany({
                where: { id: { in: allStudentIds } },
                include: { user: { select: { firstName: true, lastName: true } } },
            })
            : [];
        const studentById = new Map(students.map(s => [s.id, s]));

        return requests.map(request => ({
            ...request,
            students: request.studentIds.map(id => studentById.get(id)).filter(Boolean),
        }));
    }

    async listMyClassRequests(tutorUserId: number) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId: tutorUserId } });
        if (!tutor) {
            throw new NotFoundException('Tutor profile not found');
        }

        return this.prisma.classRequest.findMany({
            where: { tutorId: tutor.id },
            include: { subject: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async approveClassRequest(requestId: number, dto: ApproveClassRequestDto, adminId: number) {
        const request = await this.prisma.classRequest.findUnique({
            where: { id: requestId },
            include: { tutor: true },
        });
        if (!request) {
            throw new NotFoundException('Class request not found');
        }

        // Atomic conditional update: only claims the request if it's still PENDING, so a
        // concurrent approve/reject can't both "succeed" against the same stale read (same
        // pattern as approveUser/rejectUser above).
        const claim = await this.prisma.classRequest.updateMany({
            where: { id: requestId, status: ClassRequestStatus.PENDING },
            data: { status: ClassRequestStatus.APPROVED, reviewedById: adminId, reviewedAt: new Date() },
        });
        if (claim.count === 0) {
            throw new ConflictException('Class request is not in PENDING status');
        }

        try {
            const newClass = await this.materializeClass({
                tutorId: request.tutorId,
                subjectId: request.subjectId,
                studentIds: request.studentIds,
                name: request.name ?? undefined,
                grade: request.grade ?? undefined,
                schedule: request.schedule as unknown as ClassScheduleDto[],
                startDate: request.startDate ?? undefined,
                frequency: request.frequency ?? undefined,
                numberOfWeeks: request.numberOfWeeks ?? undefined,
                createSessions: request.createSessions,
                studentRateAmount: dto.studentRateAmount,
                studentRateCurrency: dto.studentRateCurrency,
                studentPriceAmount: dto.studentPriceAmount,
                studentPriceCurrency: dto.studentPriceCurrency,
                tutorHourlyRate: dto.tutorHourlyRate,
                tutorRateCurrency: dto.tutorRateCurrency,
                adminId,
            });

            await this.prisma.classRequest.update({
                where: { id: requestId },
                data: { resultingClassId: newClass!.id },
            });

            try {
                await this.notificationService.createNotification(
                    request.tutor.userId,
                    'Class request approved',
                    `Your request for "${newClass!.name}" has been approved and is now live.`,
                    NotificationType.CLASS,
                );
            } catch (error) {
                console.error('Failed to send class approval notification:', error);
            }

            return newClass;
        } catch (error) {
            // Materialization failed (e.g. a schedule conflict) — release the claim so the
            // request can be retried instead of being stuck "approved" with no resulting class.
            await this.prisma.classRequest.updateMany({
                where: { id: requestId, status: ClassRequestStatus.APPROVED },
                data: { status: ClassRequestStatus.PENDING, reviewedById: null, reviewedAt: null },
            });
            throw error;
        }
    }

    async rejectClassRequest(requestId: number, reason: string | undefined, adminId: number) {
        const request = await this.prisma.classRequest.findUnique({
            where: { id: requestId },
            include: { tutor: true },
        });
        if (!request) {
            throw new NotFoundException('Class request not found');
        }

        // Same atomic-conditional-update guard as rejectUser: only flips PENDING -> REJECTED
        // if the status is still PENDING, so a concurrent approve/reject race can't both win.
        const result = await this.prisma.classRequest.updateMany({
            where: { id: requestId, status: ClassRequestStatus.PENDING },
            data: {
                status: ClassRequestStatus.REJECTED,
                rejectionReason: reason,
                reviewedById: adminId,
                reviewedAt: new Date(),
            },
        });
        if (result.count === 0) {
            throw new ConflictException('Class request is not in PENDING status');
        }

        try {
            await this.notificationService.createNotification(
                request.tutor.userId,
                'Class request rejected',
                reason ? `Your class request was rejected: ${reason}` : 'Your class request was rejected.',
                NotificationType.CLASS,
            );
        } catch (error) {
            console.error('Failed to send class rejection notification:', error);
        }

        return this.prisma.classRequest.findUnique({ where: { id: requestId } });
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

    async approveUser(userId: number, hourlyRate?: number, currency?: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Atomic conditional update: only flips PENDING -> ACTIVE if the status is still
        // PENDING at the moment of the write, so a concurrent approve/reject can't both
        // "succeed" against the same stale read.
        const result = await this.prisma.user.updateMany({
            where: { id: userId, status: UserStatus.PENDING },
            data: { status: UserStatus.ACTIVE },
        });

        if (result.count === 0) {
            throw new ConflictException('User is not in PENDING status');
        }

        if (user.userType === UserRole.TUTOR) {
            try {
                await this.updateTutorRate(userId, {
                    ...(hourlyRate !== undefined && { hourlyRate }),
                    currency: currency ?? 'LKR',
                });
            } catch (error) {
                // Missing Tutor profile is an edge case that shouldn't block approval.
                console.error(`Failed to set hourly rate/currency during approval for user ${userId}:`, error);
            }
        }

        const updatedUser = await this.prisma.user.findUnique({ where: { id: userId } });

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

        // Same atomic-conditional-update guard as approveUser: only flips PENDING -> INACTIVE
        // if the status is still PENDING, so a concurrent approve/reject race can't both win.
        const result = await this.prisma.user.updateMany({
            where: { id: userId, status: UserStatus.PENDING },
            data: { status: UserStatus.INACTIVE },
        });

        if (result.count === 0) {
            throw new ConflictException('User is not in PENDING status');
        }

        const updatedUser = await this.prisma.user.findUnique({ where: { id: userId } });

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

    async updateUserByAdmin(id: number, data: UpdateUserByAdminDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updateData: any = {};
        if (data.firstName !== undefined) updateData.firstName = data.firstName;
        if (data.lastName !== undefined) updateData.lastName = data.lastName;
        if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
        if (data.status !== undefined) updateData.status = (typeof data.status === 'string' ? (data.status as string).toUpperCase() : data.status) as UserStatus;
        if (data.userType !== undefined) updateData.userType = data.userType;

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: updateData,
            include: {
                studentProfile: true,
                tutorProfile: true,
                parentProfile: true,
                coordinatorProfile: true,
            }
        });

        const { passwordHash, ...result } = updatedUser;
        return result;
    }

    async updateTutorRate(userId: number, data: { hourlyRate?: number; currency?: string }) {
        const tutor = await this.prisma.tutor.findUnique({ where: { userId } });
        if (!tutor) {
            throw new NotFoundException('Tutor profile not found');
        }

        if (data.hourlyRate === undefined && data.currency === undefined) {
            throw new BadRequestException('At least one of hourlyRate or currency must be provided');
        }

        return this.prisma.tutor.update({
            where: { userId },
            data: {
                ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
                ...(data.currency !== undefined && { currency: data.currency }),
            },
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
