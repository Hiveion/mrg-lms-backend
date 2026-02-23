import { IsInt, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class CreateEnrollmentDto {
    @IsInt()
    @IsNotEmpty()
    studentId: number;

    @IsInt()
    @IsNotEmpty()
    classId: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    assignedPrice?: number;

    @IsEnum(EnrollmentStatus)
    @IsOptional()
    status?: EnrollmentStatus;
}

export class UpdateEnrollmentDto {
    @IsEnum(EnrollmentStatus)
    @IsOptional()
    status?: EnrollmentStatus;

    @IsOptional()
    confirmationDate?: Date;
}

export class UpdateAssignedPriceDto {
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    assignedPrice: number;
}
