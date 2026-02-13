-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARENT';

-- CreateTable
CREATE TABLE "parents" (
    "parent_id" SERIAL NOT NULL,
    "relationship" TEXT,
    "occupation" TEXT,
    "number_of_children" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("parent_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parents_user_id_key" ON "parents"("user_id");

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
