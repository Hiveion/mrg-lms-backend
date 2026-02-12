import {
    IsEnum,
    IsOptional,
    IsString,
    IsArray,
    ValidateIf,
} from 'class-validator';
import { UserRole } from '@prisma/client';

/**
 * DTO for updating user profile
 * Excludes data extracted from Google account (email, googleId, profilePicture)
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

    @IsEnum(UserRole)
    @IsOptional()
    userType?: UserRole;

    // Tutor-specific fields
    @ValidateIf((o) => o.userType === UserRole.TUTOR)
    @IsString()
    @IsOptional()
    bio?: string;

    @ValidateIf((o) => o.userType === UserRole.TUTOR)
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    qualifications?: string[];

    // Student-specific fields
    @ValidateIf((o) => o.userType === UserRole.STUDENT)
    @IsString()
    @IsOptional()
    grade?: string;
}
