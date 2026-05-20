import { IsNotEmpty, IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class ApproveExtraClassDto {
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    rate: number;

    @IsString()
    @IsOptional()
    link?: string;
}

export class DeclineExtraClassDto {
    @IsString()
    @IsOptional()
    reason?: string;
}
