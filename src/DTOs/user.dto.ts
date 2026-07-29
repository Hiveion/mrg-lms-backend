import {
    IsEnum,
    IsOptional,
    IsString,
    IsArray,
    IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsString()
    @IsOptional()
    profilePicture?: string;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsEnum(UserRole)
    @IsOptional()
    userType?: UserRole;

    @IsEnum(UserStatus)
    @IsOptional()
    status?: UserStatus;

    // Tutor-specific fields
    @IsString()
    @IsOptional()
    bio?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    qualifications?: string[];

    // Student-specific fields
    @IsString()
    @IsOptional()
    grade?: string;

    @IsString()
    @IsOptional()
    currency?: string;

    // Parent-specific fields
    @IsString()
    @IsOptional()
    occupation?: string;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    numberOfChildren?: number;
}
