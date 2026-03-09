-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "frequency" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "schedule" JSONB;
