import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, IsInt, IsArray, ValidateNested, IsNumber, IsBoolean, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserStatus, WeekDay } from '@prisma/client';

export const TUTOR_CURRENCIES = ['LKR', 'USD', 'MVR'] as const;

export class InviteUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsEnum(UserRole)
    @IsOptional()
    userType?: UserRole;
}

export class CreateUserByAdminDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsEnum(UserRole)
    @IsNotEmpty()
    userType: UserRole;
}

export class UpdateUserByAdminDto {
    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsEnum(UserStatus)
    @IsOptional()
    status?: UserStatus;

    @IsEnum(UserRole)
    @IsOptional()
    userType?: UserRole;
}

export class UpdateTutorRateDto {
    @IsNumber()
    @Min(0)
    @IsOptional()
    hourlyRate?: number;

    @IsIn(TUTOR_CURRENCIES)
    @IsOptional()
    currency?: string;
}

export class ApproveUserDto {
    @IsNumber()
    @Min(0)
    @IsOptional()
    hourlyRate?: number;

    @IsIn(TUTOR_CURRENCIES)
    @IsOptional()
    currency?: string;
}

export class ClassScheduleDto {
    @IsEnum(WeekDay)
    @IsNotEmpty()
    day: WeekDay;

    @IsString()
    @IsNotEmpty()
    startTime: string; // "HH:mm"

    @IsInt()
    @IsNotEmpty()
    duration: number; // in minutes
}

export class AssignClassDto {
    @IsInt()
    @IsOptional()
    studentId?: number; // Kept for backward compatibility

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    studentIds?: number[];

    @IsInt()
    @IsNotEmpty()
    tutorId: number;

    @IsInt()
    @IsNotEmpty()
    subjectId: number;

    @IsString()
    @IsOptional()
    grade?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ClassScheduleDto)
    schedule: ClassScheduleDto[];

    @IsString()
    @IsOptional()
    startDate?: string;

    @IsInt()
    @IsOptional()
    frequency?: number;

    @IsInt()
    @IsOptional()
    numberOfWeeks?: number;

    @IsString()
    @IsOptional()
    name?: string;

    @IsInt()
    @IsOptional()
    maxStudents?: number;

    @IsNumber()
    @IsOptional()
    baseFee?: number;

    @IsNumber()
    @IsOptional()
    studentPrice?: number;

    @IsBoolean()
    @IsOptional()
    createSessions?: boolean;
}
