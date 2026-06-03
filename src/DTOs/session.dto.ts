import { IsNotEmpty, IsInt, IsOptional, IsEnum, IsDateString, IsString, Min, ValidateIf, IsNumber } from 'class-validator';
import { SessionStatus, SessionType } from '@prisma/client';

export class CreateSessionDto {
    @IsInt()
    @IsNotEmpty()
    classId: number;

    @IsDateString()
    @IsNotEmpty()
    dateTime: string;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    duration: number;

    @IsEnum(SessionType)
    @IsNotEmpty()
    type: SessionType;

    @IsEnum(SessionStatus)
    @IsOptional()
    status?: SessionStatus;

    @IsInt()
    @IsOptional()
    rescheduledSessionId?: number;

    @IsString()
    @IsOptional()
    cancellationReason?: string;

    @IsString()
    @IsOptional()
    link?: string;

    @ValidateIf(o => o.type === SessionType.EXTRA)
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    extraClassRate?: number;
}

export class UpdateSessionDto {
    @IsInt()
    @IsOptional()
    classId?: number;

    @IsDateString()
    @IsOptional()
    dateTime?: string;

    @IsInt()
    @IsOptional()
    @Min(1)
    duration?: number;
    
    @IsEnum(SessionType)
    @IsOptional()
    type?: SessionType;

    @IsEnum(SessionStatus)
    @IsOptional()
    status?: SessionStatus;

    @IsInt()
    @IsOptional()
    rescheduledSessionId?: number;

    @IsString()
    @IsOptional()
    cancellationReason?: string;

    @IsString()
    @IsOptional()
    link?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    extraClassRate?: number;
}

export class CreateSessionFeedbackDto {
    @IsInt()
    @IsNotEmpty()
    @Min(1)
    rating: number;

    @IsString()
    @IsNotEmpty()
    note: string;
}
