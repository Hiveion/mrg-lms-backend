import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../Services/users.service';
import { PrismaService } from '../Database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto } from '../DTOs/auth.dto';
import { User, UserStatus, UserRole } from '@prisma/client';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findOne(email);
        if (user && user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
            if (user.status === UserStatus.INACTIVE) {
                throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
            }
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { email: user.email, sub: user.id, role: user.userType };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                profilePicture: user.profilePicture,
                phoneNumber: user.phoneNumber,
                userType: user.userType,
                status: user.status,
                mustChangePassword: user.mustChangePassword,
                studentProfile: user.studentProfile,
                tutorProfile: user.tutorProfile,
                parentProfile: user.parentProfile,
                coordinatorProfile: user.coordinatorProfile,
            }
        };
    }

    async register(registerDto: RegisterDto) {
        // Enforce GMAIL MUST BE USED for all registrations
        if (!registerDto.email.toLowerCase().endsWith('@gmail.com')) {
            throw new ConflictException('Only Gmail addresses are allowed');
        }

        const existingUser = await this.usersService.findOne(registerDto.email);

        if (existingUser) {
            // Check if it's an invited user pending setup
            if (existingUser.status === UserStatus.INCOMPLETE) {
                // Check if invitation has expired
                const invitationExpiresAt = (existingUser as any).invitationExpiresAt;
                if (invitationExpiresAt && new Date() > new Date(invitationExpiresAt)) {
                    throw new UnauthorizedException('Invitation has expired. Please ask for a new one.');
                }
                // Continue with registration for this invited user
            } else {
                throw new ConflictException('User with this email already exists');
            }
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        let user;
        if (existingUser && existingUser.status === UserStatus.INCOMPLETE) {
            // Update the invited user
            user = await this.usersService.update(existingUser.id, {
                passwordHash: hashedPassword,
                firstName: registerDto.firstName,
                lastName: registerDto.lastName,
                phoneNumber: registerDto.phoneNumber,
                userType: registerDto.userType || existingUser.userType,
                status: (registerDto.userType === UserRole.TUTOR || registerDto.userType === UserRole.STUDENT)
                    ? UserStatus.PENDING
                    : UserStatus.ACTIVE,
                invitationExpiresAt: null, // Clear expiry
            } as any);

            // Create profile based on selected role
            if (registerDto.userType === UserRole.TUTOR) {
                await this.prisma.tutor.create({ data: { userId: user.id, bio: registerDto.bio, qualifications: registerDto.qualifications || [] } });
            } else if (registerDto.userType === UserRole.STUDENT) {
                await this.prisma.student.create({ data: { userId: user.id, grade: registerDto.grade } });
            } else if (registerDto.userType === UserRole.PARENT) {
                await this.prisma.parent.create({ data: { userId: user.id, occupation: registerDto.occupation, numberOfChildren: registerDto.numberOfChildren || 0 } });
            } else if (registerDto.userType === UserRole.COORDINATOR) {
                await this.prisma.coordinator.create({ data: { userId: user.id } });
            }
        } else {
            // Create new incomplete user
            user = await this.usersService.create({
                email: registerDto.email,
                passwordHash: hashedPassword,
                firstName: registerDto.firstName,
                lastName: registerDto.lastName,
                phoneNumber: registerDto.phoneNumber,
                userType: registerDto.userType,
                status: (registerDto.userType === UserRole.TUTOR || registerDto.userType === UserRole.STUDENT)
                    ? UserStatus.PENDING
                    : UserStatus.ACTIVE,
                tutorProfile: registerDto.userType === UserRole.TUTOR ? {
                    create: {
                        bio: registerDto.bio,
                        qualifications: registerDto.qualifications || [],
                    }
                } : undefined,
                studentProfile: registerDto.userType === UserRole.STUDENT ? {
                    create: {
                        grade: registerDto.grade,
                    }
                } : undefined,
                parentProfile: registerDto.userType === UserRole.PARENT ? {
                    create: {
                        occupation: registerDto.occupation,
                        numberOfChildren: registerDto.numberOfChildren || 0,
                    }
                } : undefined,
                coordinatorProfile: registerDto.userType === UserRole.COORDINATOR ? {
                    create: {}
                } : undefined,
            });
        }

        const { passwordHash, ...userResult } = user as any;
        const token = await this.login(user);

        return {
            access_token: token.access_token,
            user: userResult,
        };
    }

    async googleLogin(req: any) {
        if (!req.user) {
            throw new UnauthorizedException('No user from google');
        }

        const { email, firstName, lastName, picture, googleId } = req.user;
        let user = await this.usersService.findOne(email);

        if (!user) {
            user = await this.usersService.create({
                email,
                firstName,
                lastName,
                googleId,
                profilePicture: picture,
                passwordHash: null,
                userType: null,
                status: UserStatus.INCOMPLETE,
            });
        } else {
            if (user.status === UserStatus.INACTIVE) {
                throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
            }
            // Update googleId and profilePicture if not present
            if (!user.googleId || !user.profilePicture) {
                // We need an update method in usersService, but for now we can rely on user already existing
                // Ideally we should update the existing user record with google info
            }
        }

        const token = await this.login(user);
        return {
            ...token,
            user: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                picture: user.profilePicture,
                status: user.status,
                role: user.userType
            }
        };
    }

    async completeRegistration(userId: number, completeDto: any) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.status !== UserStatus.INCOMPLETE) {
            // User already registered
            // throw new ConflictException('User already registered');
            // Or just return user
        }

        // Both TUTORs and STUDENTs need approval (status: PENDING), all other roles are ACTIVE immediately
        const status = (completeDto.userType === UserRole.TUTOR || completeDto.userType === UserRole.STUDENT)
            ? UserStatus.PENDING
            : UserStatus.ACTIVE;

        return this.usersService.update(userId, {
            userType: completeDto.userType,
            status: status,
            phoneNumber: completeDto.phoneNumber,
            tutorProfile: completeDto.userType === UserRole.TUTOR ? {
                create: {
                    bio: completeDto.bio,
                    qualifications: completeDto.qualifications || [],
                }
            } : undefined,
            studentProfile: completeDto.userType === UserRole.STUDENT ? {
                create: {
                    grade: completeDto.grade,
                }
            } : undefined,
            parentProfile: completeDto.userType === UserRole.PARENT ? {
                create: {
                    occupation: completeDto.occupation,
                    numberOfChildren: completeDto.numberOfChildren || 0,
                }
            } : undefined,
            coordinatorProfile: completeDto.userType === UserRole.COORDINATOR ? {
                create: {}
            } : undefined,
        });
    }

    async updateUserProfile(userId: number, updateDto: any) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Update the user profile using the updateProfile method
        const updatedUser = await this.usersService.updateProfile(userId, updateDto);

        // Return the updated user without sensitive data
        const { passwordHash, ...result } = updatedUser;
        return result;
    }

    async changePassword(userId: number, newPassword: string) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.usersService.update(userId, {
            passwordHash: hashedPassword,
            mustChangePassword: false,
        });
        return { message: 'Password changed successfully' };
    }

    async forgotPassword(email: string) {
        const user = await this.usersService.findOne(email);
        if (!user) {
            // To prevent email enumeration, we still return a success message
            return { message: 'If an account with that email exists, a password reset link has been sent.' };
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await this.usersService.update(user.id, {
            resetPasswordToken: token,
            resetPasswordExpires: expires,
        } as any);

        await this.mailService.sendPasswordResetEmail(email, token);

        return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    gt: new Date(),
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid or expired password reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.usersService.update(user.id, {
            passwordHash: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            mustChangePassword: false,
        } as any);

        return { message: 'Password has been reset successfully' };
    }
}

