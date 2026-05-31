import { IsString, IsEnum, IsArray, ValidateNested, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class GenerateInvoicesDto {
    @IsString()
    month: string; // "YYYY-MM"
}

export class UpdateInvoiceStatusDto {
    @IsEnum(InvoiceStatus)
    status: InvoiceStatus;
}

export class InvoiceItemDto {
    @IsNumber()
    classId: number;

    @IsString()
    description: string;

    @IsNumber()
    amount: number;
}

export class UpdateInvoiceDto {
    @IsOptional()
    @IsString()
    month?: string;

    @IsOptional()
    @IsNumber()
    discount?: number;

    @IsOptional()
    @IsNumber()
    additionalPayment?: number;

    @IsOptional()
    @IsEnum(InvoiceStatus)
    status?: InvoiceStatus;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => InvoiceItemDto)
    items?: InvoiceItemDto[];
}

export class CreateInvoiceDto {
    @IsNumber()
    studentId: number;

    @IsString()
    month: string; // "YYYY-MM"

    @IsString()
    dueDate: string; // ISO date string

    @IsOptional()
    @IsNumber()
    discount?: number;

    @IsOptional()
    @IsNumber()
    additionalPayment?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => InvoiceItemDto)
    items: InvoiceItemDto[];
}
