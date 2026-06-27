import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PayoutStatus } from '@prisma/client';

export class GeneratePayoutsDto {
    @IsString()
    month: string; // "YYYY-MM"
}

export class UpdatePayoutStatusDto {
    @IsEnum(PayoutStatus)
    status: PayoutStatus;

    @IsOptional()
    @IsString()
    transactionReference?: string;
}
