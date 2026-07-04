import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
