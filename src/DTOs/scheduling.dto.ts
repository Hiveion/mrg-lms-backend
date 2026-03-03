import { IsEnum, IsString, Matches, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WeekDay } from '@prisma/client';

export class AvailabilitySlotDto {
    @IsEnum(WeekDay)
    day: WeekDay;

    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm format' })
    startTime: string;

    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be in HH:mm format' })
    endTime: string;
}

export class SetAvailabilityDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AvailabilitySlotDto)
    slots: AvailabilitySlotDto[];
}
