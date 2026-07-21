-- This migration closes gaps that existed in migration history since the Resource and
-- Payout features (and the users.timezone column) were originally built using `prisma db
-- push` in development and never captured as proper migrations. Verified via
-- `prisma migrate diff` against a database with every prior migration applied: these
-- objects genuinely do not exist anywhere in migration history, on production, or on any
-- environment built purely from `prisma migrate deploy`.
--
-- Written defensively (IF NOT EXISTS / DO blocks) in case any target database already has
-- partial state from a manual fix.

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayoutStatus') THEN
        CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "resources" (
    "resource_id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "uploaded_by_id" INTEGER NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tutor_payouts" (
    "payout_id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "additional_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "notes" TEXT,
    "slip_url" TEXT,
    "slip_file_id" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_payouts_pkey" PRIMARY KEY ("payout_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tutor_payout_items" (
    "item_id" SERIAL NOT NULL,
    "payout_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "hours_count" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_payout_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_payouts_tutor_id_month_key" ON "tutor_payouts"("tutor_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tutor_payout_items_payout_id_class_id_key" ON "tutor_payout_items"("payout_id", "class_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_class_id_fkey') THEN
        ALTER TABLE "resources" ADD CONSTRAINT "resources_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_uploaded_by_id_fkey') THEN
        ALTER TABLE "resources" ADD CONSTRAINT "resources_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutor_payouts_tutor_id_fkey') THEN
        ALTER TABLE "tutor_payouts" ADD CONSTRAINT "tutor_payouts_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("tutor_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutor_payout_items_payout_id_fkey') THEN
        ALTER TABLE "tutor_payout_items" ADD CONSTRAINT "tutor_payout_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "tutor_payouts"("payout_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutor_payout_items_class_id_fkey') THEN
        ALTER TABLE "tutor_payout_items" ADD CONSTRAINT "tutor_payout_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
