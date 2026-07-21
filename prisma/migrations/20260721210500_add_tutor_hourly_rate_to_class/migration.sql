-- AlterTable
-- Migration history never actually added this column despite schema.prisma expecting it
-- on Class (the "add_tutor_hourly_rate" migration only ever touched discussion_likes/
-- reply_likes). Adding it here, idempotently, to bring migration history in line with
-- the current schema.
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "tutor_hourly_rate" DOUBLE PRECISION;
