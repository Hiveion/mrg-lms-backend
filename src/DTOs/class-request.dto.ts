import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClassScheduleDto } from './admin.dto';

/**
 * Submitted by a TUTOR to request a new class. Deliberately has no fee
 * fields (studentRateAmount/studentRateCurrency/tutorHourlyRate/studentPrice*)
 * and no tutorId — the tutor is derived from the caller's JWT, never from
 * the body. An admin/coordinator sets both fees when approving the request
 * (see ApproveClassRequestDto).
 */
export class RequestClassDto {
    @IsInt()
    @IsOptional()
    studentId?: number; // Kept for backward compatibility with AssignClassDto's shape

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    studentIds?: number[];

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

    @IsBoolean()
    @IsOptional()
    createSessions?: boolean;
}

export class ApproveClassRequestDto {
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    studentRateAmount: number;

    @IsString()
    @IsNotEmpty()
    studentRateCurrency: string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    tutorHourlyRate: number;

    @IsString()
    @IsNotEmpty()
    tutorRateCurrency: string;

    @IsNumber()
    @IsOptional()
    studentPriceAmount?: number;

    @ValidateIf((dto) => dto.studentPriceAmount !== undefined)
    @IsString()
    @IsNotEmpty()
    studentPriceCurrency?: string;
}

export class RejectClassRequestDto {
    @IsString()
    @IsOptional()
    reason?: string;
}
