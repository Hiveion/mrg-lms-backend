/*
  Warnings:

  - You are about to drop the column `registration_date` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[google_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'INCOMPLETE';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "registration_date",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "profile_picture" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "password_hash" DROP NOT NULL,
ALTER COLUMN "user_type" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
