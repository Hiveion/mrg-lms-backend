import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRatingDto {
    @IsInt()
    tutorId: number;

    @IsNumber()
    @Min(0)
    @Max(5)
    overallRating: number;

    @IsInt()
    @Min(1)
    @Max(5)
    teachingQuality: number;

    @IsInt()
    @Min(1)
    @Max(5)
    communication: number;

    @IsInt()
    @Min(1)
    @Max(5)
    punctuality: number;

    @IsOptional()
    @IsString()
    review?: string;
}

export class UpdateRatingDto {
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(5)
    overallRating?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    teachingQuality?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    communication?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    punctuality?: number;

    @IsOptional()
    @IsString()
    review?: string;
}
