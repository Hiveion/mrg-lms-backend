import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, WeekDay } from '@prisma/client';

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
    @IsNotEmpty()
    studentId: number;

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
}
