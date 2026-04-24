/*
  Warnings:

  - You are about to drop the column `session_type` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "session_type",
ADD COLUMN     "type" "SessionType" NOT NULL DEFAULT 'REGULAR';
