/*
  Warnings:

  - You are about to drop the `recordings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "recordings" DROP CONSTRAINT "recordings_class_id_fkey";

-- DropForeignKey
ALTER TABLE "recordings" DROP CONSTRAINT "recordings_session_id_fkey";

-- DropTable
DROP TABLE "recordings";

-- DropEnum
DROP TYPE "RecordingStatus";
