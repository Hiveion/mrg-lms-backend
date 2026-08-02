/*
  Warnings:

  - You are about to drop the column `class_fee` on the `classes` table. All the data in the column will be lost.
  - Added the required column `price_currency` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `tutor_payouts` table without a default value. This is not possible if the table is not empty.

*/

-- AlterTable: classes.class_fee -> studentRateAmount/studentRateCurrency
ALTER TABLE "classes" DROP COLUMN "class_fee";
ALTER TABLE "classes" ADD COLUMN "student_rate_amount" DOUBLE PRECISION;
ALTER TABLE "classes" ADD COLUMN "student_rate_currency" TEXT;

-- AlterTable: enrollments.price_currency (backfill existing rows, then drop the temporary default)
ALTER TABLE "enrollments" ADD COLUMN "price_currency" TEXT NOT NULL DEFAULT 'MVR';
ALTER TABLE "enrollments" ALTER COLUMN "price_currency" DROP DEFAULT;

-- AlterTable: invoices.currency (backfill existing rows, then drop the temporary default)
ALTER TABLE "invoices" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MVR';
ALTER TABLE "invoices" ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable: tutor_payouts.currency (backfill existing rows, then drop the temporary default)
ALTER TABLE "tutor_payouts" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "tutor_payouts" ALTER COLUMN "currency" DROP DEFAULT;
