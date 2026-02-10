
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
        if (user && (await bcrypt.compare(pass, user.passwordHash))) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { email: user.email, sub: user.id, role: user.userType };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async register(registerDto: RegisterDto) {
        const existingUser = await this.usersService.findOne(registerDto.email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        const user = await this.usersService.create({
            email: registerDto.email,
            passwordHash: hashedPassword,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            phoneNumber: registerDto.phoneNumber,
            userType: registerDto.userType,
            status: UserStatus.PENDING,
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
        });

        const { passwordHash, ...result } = user;
        return result;
    }
}
