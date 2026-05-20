-- CreateEnum
CREATE TYPE "SessionTranscriptStatus" AS ENUM ('PENDING', 'SAVED', 'NOT_FOUND');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "transcript_file_id" TEXT,
ADD COLUMN     "transcript_status" "SessionTranscriptStatus" DEFAULT 'PENDING',
ADD COLUMN     "transcript_url" TEXT;
