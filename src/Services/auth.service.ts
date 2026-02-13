
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../Services/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from '../DTOs/auth.dto';
import { User, UserStatus, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findOne(email);
        if (user && user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
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
            }
        };
    }

    async register(registerDto: RegisterDto) {
        const existingUser = await this.usersService.findOne(registerDto.email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        // Only TUTORs need approval (status: PENDING), all other roles are ACTIVE immediately
        const status = registerDto.userType === UserRole.TUTOR ? UserStatus.PENDING : UserStatus.ACTIVE;

        const user = await this.usersService.create({
            email: registerDto.email,
            passwordHash: hashedPassword,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            phoneNumber: registerDto.phoneNumber,
            userType: registerDto.userType,
            status: status,
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

        const { passwordHash, ...userResult } = user;
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

        // Only TUTORs need approval (status: PENDING), all other roles are ACTIVE immediately
        const status = completeDto.userType === UserRole.TUTOR ? UserStatus.PENDING : UserStatus.ACTIVE;

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
}
