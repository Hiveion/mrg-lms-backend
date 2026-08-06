import { IsString, IsNotEmpty, IsInt, IsOptional, IsBoolean, Min, IsNumber, ValidateIf } from 'class-validator';

export class CreateClassDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @IsNotEmpty()
    subjectId: number;

    @IsInt()
    @IsNotEmpty()
    tutorId: number;

    @IsString()
    @IsOptional()
    grade?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsBoolean()
    @IsOptional()
    isDemo?: boolean;

    @IsNumber()
    @IsOptional()
    @Min(0)
    studentRateAmount?: number;

    @ValidateIf((dto) => dto.studentRateAmount !== undefined)
    @IsString()
    @IsNotEmpty()
    studentRateCurrency?: string;

    @IsNumber()
    @IsOptional()
    @Min(0)
    tutorHourlyRate?: number;

    @ValidateIf((dto) => dto.tutorHourlyRate !== undefined)
    @IsString()
    @IsNotEmpty()
    tutorRateCurrency?: string;
}

export class UpdateClassDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsInt()
    @IsOptional()
    subjectId?: number;

    @IsInt()
    @IsOptional()
    tutorId?: number;

    @IsString()
    @IsOptional()
    grade?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsBoolean()
    @IsOptional()
    isDemo?: boolean;

    @IsNumber()
    @IsOptional()
    @Min(0)
    studentRateAmount?: number;

    @ValidateIf((dto) => dto.studentRateAmount !== undefined)
    @IsString()
    @IsNotEmpty()
    studentRateCurrency?: string;

    @IsNumber()
    @IsOptional()
    @Min(0)
    tutorHourlyRate?: number;

    @ValidateIf((dto) => dto.tutorHourlyRate !== undefined)
    @IsString()
    @IsNotEmpty()
    tutorRateCurrency?: string;
}

