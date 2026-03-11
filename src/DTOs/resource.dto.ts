import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateResourceDto {
    @IsInt()
    @IsNotEmpty()
    classId: number;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsNotEmpty()
    fileUrl: string;

    @IsString()
    @IsNotEmpty()
    fileType: string;

    @IsInt()
    @IsNotEmpty()
    fileSize: number;
}

export class UpdateResourceDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
