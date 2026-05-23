import { IsInt, IsNotEmpty, IsOptional, IsString, IsEnum, IsUrl, IsDateString } from 'class-validator';
// recording.dto.ts
export class RecordingQueryDto {
    sessionId?: number;
}
