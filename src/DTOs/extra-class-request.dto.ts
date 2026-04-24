import { IsNotEmpty, IsInt, IsOptional, IsDateString, IsString, Min } from 'class-validator';

export class RequestExtraClassDto {
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

    @IsString()
    @IsOptional()
    reason?: string;
}
