-- AlterTable
-- Made idempotent: this column was never actually added to "sessions" in migration
-- history (the corresponding "add_tutor_hourly_rate" migration never touched this
-- table), so the unconditional DROP fails on any DB applying migrations from scratch.
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "tutor_hourly_rate";
