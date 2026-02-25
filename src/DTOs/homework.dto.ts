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

export class CreateSubmissionAnswerDto {
    @IsInt()
    @IsNotEmpty()
    questionId: number;

    @IsString()
    @IsNotEmpty()
    answerText: string;
}

export class CreateHomeworkSubmissionDto {
    @IsInt()
    @IsNotEmpty()
    homeworkId: number;

    @IsString()
    @IsOptional()
    submissionFileUrl?: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateSubmissionAnswerDto)
    answers?: CreateSubmissionAnswerDto[];
}

export class GradeAnswerDto {
    @IsInt()
    @IsNotEmpty()
    answerId: number;

    @IsNumber()
    @Min(0)
    marksAwarded: number;
}

export class GradeSubmissionDto {
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    totalMarksAwarded: number;

    @IsString()
    @IsOptional()
    feedback?: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => GradeAnswerDto)
    answerMarks?: GradeAnswerDto[];
}
