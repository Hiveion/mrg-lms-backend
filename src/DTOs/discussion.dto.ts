import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsInt } from 'class-validator';
import { DiscussionType } from '@prisma/client';

export class CreateThreadDto {
    @IsInt()
    @IsNotEmpty()
    classId: number;

    @IsEnum(DiscussionType)
    @IsNotEmpty()
    type: DiscussionType;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    body: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}

export class CreateReplyDto {
    @IsString()
    @IsNotEmpty()
    content: string;
}
