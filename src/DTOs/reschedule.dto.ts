import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRescheduleRequestDto {
    @IsNotEmpty()
    @IsDateString()
    proposedDateTime: string; // ISO 8601 string

    @IsOptional()
    @IsString()
    reason?: string;
}

export class RespondRescheduleRequestDto {
    @IsOptional()
    @IsString()
    responseReason?: string;
}
