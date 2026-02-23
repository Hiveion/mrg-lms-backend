import { IsString, IsNotEmpty, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

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

    @IsInt()
    @IsOptional()
    @Min(1)
    maxStudentCount?: number;
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

    @IsInt()
    @IsOptional()
    @Min(1)
    maxStudentCount?: number;
}
