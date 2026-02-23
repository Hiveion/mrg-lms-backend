import { IsNotEmpty, IsInt, IsOptional, IsEnum, IsDateString, IsString, Min } from 'class-validator';
import { SessionStatus } from '@prisma/client';

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
}
