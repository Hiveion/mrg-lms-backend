/*
  Warnings:

  - A unique constraint covering the columns `[user_id,tutor_id]` on the table `ratings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_tutor_id_key" ON "ratings"("user_id", "tutor_id");
