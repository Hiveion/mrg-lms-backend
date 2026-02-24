import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsInt, IsArray, ValidateNested, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { HomeworkType, DeadlineType, QuestionType } from '@prisma/client';

export class CreateHomeworkQuestionDto {
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @IsEnum(QuestionType)
    @IsNotEmpty()
    questionType: QuestionType;

    @IsNumber()
    @Min(0)
    marks: number;

    @IsString()
    @IsOptional()
    correctAnswer?: string;
}

export class CreateHomeworkDto {
    @IsInt()
    @IsNotEmpty()
    classId: number;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(HomeworkType)
    @IsNotEmpty()
    type: HomeworkType;

    @IsString()
    @IsOptional()
    fileUrl?: string;

    @IsNumber()
    @Min(0)
    totalMarks: number;

    @IsEnum(DeadlineType)
    @IsNotEmpty()
    deadlineType: DeadlineType;

    @IsDateString()
    @IsOptional()
    deadlineDate?: string;

    @IsInt()
    @IsOptional()
    deadlineDays?: number;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateHomeworkQuestionDto)
    questions?: CreateHomeworkQuestionDto[];
}
