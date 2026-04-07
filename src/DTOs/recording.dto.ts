import { IsInt, IsNotEmpty, IsOptional, IsString, IsEnum, IsUrl, IsDateString } from 'class-validator';
import { RecordingStatus } from '@prisma/client';

export class CreateRecordingDto {
    @IsInt()
    @IsNotEmpty()
    sessionId: number;

    @IsInt()
    @IsNotEmpty()
    classId: number;

    @IsUrl()
    @IsNotEmpty()
    videoUrl: string;

    @IsString()
    @IsOptional()
    duration?: string;

    @IsString()
    @IsOptional()
    fileSize?: string;

    @IsInt()
    @IsOptional()
    retentionDays?: number;

    @IsEnum(RecordingStatus)
    @IsOptional()
    status?: RecordingStatus;

    @IsDateString()
    @IsNotEmpty()
    expiresAt: string;
}

export class UpdateRecordingDto {
    @IsUrl()
    @IsOptional()
    videoUrl?: string;

    @IsString()
    @IsOptional()
    duration?: string;

    @IsString()
    @IsOptional()
    fileSize?: string;

    @IsInt()
    @IsOptional()
    retentionDays?: number;

    @IsEnum(RecordingStatus)
    @IsOptional()
    status?: RecordingStatus;

    @IsDateString()
    @IsOptional()
    expiresAt?: string;
}
