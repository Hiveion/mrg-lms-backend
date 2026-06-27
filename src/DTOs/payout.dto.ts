import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { PayoutStatus } from '@prisma/client';

export class GeneratePayoutsDto {
    @IsString()
    month: string; // "YYYY-MM"

    @IsOptional()
    @IsNumber()
    tutorId?: number;
}

export class UpdatePayoutStatusDto {
    @IsEnum(PayoutStatus)
    status: PayoutStatus;

    @IsOptional()
    @IsString()
    transactionReference?: string;
}
