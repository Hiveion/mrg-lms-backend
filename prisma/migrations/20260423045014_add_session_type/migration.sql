-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('REGULAR', 'EXTRA');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "session_type" "SessionType" NOT NULL DEFAULT 'REGULAR';
