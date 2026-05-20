import { IsInt, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsString, IsBoolean } from 'class-validator';
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

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateEnrollmentDto {
    @IsEnum(EnrollmentStatus)
    @IsOptional()
    status?: EnrollmentStatus;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    confirmationDate?: Date;

    @IsOptional()                   
    recordingAccess?: boolean;  
}

export class UpdateAssignedPriceDto {
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    assignedPrice: number;
}

export class ToggleRecordingAccessDto {
    @IsBoolean()
    @IsNotEmpty()
    enabled: boolean;
}
