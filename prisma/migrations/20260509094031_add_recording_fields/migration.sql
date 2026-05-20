-- CreateEnum
CREATE TYPE "SessionRecordingStatus" AS ENUM ('PENDING', 'SAVED', 'NOT_FOUND');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "recording_file_id" TEXT,
ADD COLUMN     "recording_status" "SessionRecordingStatus" DEFAULT 'PENDING',
ADD COLUMN     "recording_url" TEXT;
