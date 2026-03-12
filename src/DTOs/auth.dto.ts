
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
    ValidateIf,
    IsArray,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsEnum(UserRole)
    @IsNotEmpty()
    userType: UserRole;

    // Tutor specific fields
    @ValidateIf((o) => o.userType === UserRole.TUTOR)
    @IsString()
    @IsOptional()
    bio?: string;

    @ValidateIf((o) => o.userType === UserRole.TUTOR)
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    qualifications?: string[];

    // Student specific fields
    @ValidateIf((o) => o.userType === UserRole.STUDENT)
    @IsString()
    @IsOptional()
    grade?: string;

    // Parent specific fields
    @ValidateIf((o) => o.userType === UserRole.PARENT)
    @IsString()
    @IsOptional()
    occupation?: string;

    @ValidateIf((o) => o.userType === UserRole.PARENT)
    @IsOptional()
    numberOfChildren?: number;
}

export class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;
}

export class ForgotPasswordDto {
    @IsEmail()
    email: string;
}

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;
}
