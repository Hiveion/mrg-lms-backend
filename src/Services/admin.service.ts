import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserByAdminDto, InviteUserDto } from '../DTOs/admin.dto';
import { UserStatus, UserRole } from '@prisma/client';
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
                status: status,
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
