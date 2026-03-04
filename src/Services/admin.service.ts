import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserByAdminDto, InviteUserDto } from '../DTOs/admin.dto';
import { UserStatus, UserRole } from '@prisma/client';
import { MailService } from './mail.service';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }

    async inviteUser(inviteUserDto: InviteUserDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: inviteUserDto.email },
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const user = await this.prisma.user.create({
            data: {
                email: inviteUserDto.email,
                firstName: '',
                lastName: '',
                userType: inviteUserDto.userType || null,
                status: UserStatus.PENDING,
            },
        });

        // Send invitation email
        try {
            await this.mailService.sendUserInvitation(user.email, user.userType || undefined);
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            // Optionally handle this error
        }

        return {
            message: 'Invitation sent successfully',
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
}

