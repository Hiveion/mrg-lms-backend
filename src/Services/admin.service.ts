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

        if (existingUser && existingUser.status !== UserStatus.PENDING) {
            throw new ConflictException('User with this email already exists and is not pending');
        }

        // Set invitation expiry to 4 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 4);

        let user;
        if (existingUser) {
            // Update existing pending user
            user = await this.prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    userType: inviteUserDto.userType || existingUser.userType,
                    invitationExpiresAt: expiresAt,
                } as any,
            });
        } else {
            // Create new pending user
            user = await this.prisma.user.create({
                data: {
                    email: inviteUserDto.email,
                    firstName: '',
                    lastName: '',
                    userType: inviteUserDto.userType || null,
                    status: UserStatus.PENDING,
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

        const user = await this.prisma.user.create({
            data: {
                email: createUserByAdminDto.email,
                passwordHash: hashedPassword,
                firstName: createUserByAdminDto.firstName,
                lastName: createUserByAdminDto.lastName,
                userType: createUserByAdminDto.userType,
                status: createUserByAdminDto.userType === UserRole.TUTOR ? UserStatus.PENDING : UserStatus.ACTIVE,
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
        const { studentId, tutorId, subjectId, schedule, startDate, numberOfWeeks = 4, grade } = dto;

        // Verify entities exist
        const student = await this.prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
        const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
        const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });

        if (!student || !tutor || !subject) {
            throw new NotFoundException('Student, Tutor, or Subject not found');
        }

        const className = `${subject.name} with ${student.user.firstName}`;

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
                    assignedPrice: 0,
                    confirmationDate: new Date(),
                }
            });

            // 3. Generate Sessions
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

    private getNextOccurrence(startDate: Date, targetDay: WeekDay, weekOffset: number): Date {
        const daysToIndex = {
            'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
        };
        const targetDayNum = daysToIndex[targetDay];
        const result = new Date(startDate);
        const currentDayNum = result.getDay();

        let diff = targetDayNum - currentDayNum;
        // If the day has already passed this week, move to next week for the first occurrence
        // If diff is 0, it means it's today. We'll count it as the first occurrence.
        if (diff < 0) diff += 7;

        result.setDate(result.getDate() + diff + (weekOffset * 7));
        return result;
    }
}

