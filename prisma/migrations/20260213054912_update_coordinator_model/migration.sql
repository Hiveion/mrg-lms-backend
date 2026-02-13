
-- AlterTable
ALTER TABLE "coordinators" DROP COLUMN "department",
DROP COLUMN "responsibilities",
DROP COLUMN "years_of_experience";

-- CreateTable
CREATE TABLE "subjects" (
    "subject_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("subject_id")
);

-- CreateTable
CREATE TABLE "coordinator_subjects" (
    "coordinator_subject_id" SERIAL NOT NULL,
    "coordinator_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_subjects_pkey" PRIMARY KEY ("coordinator_subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_subjects_coordinator_id_subject_id_key" ON "coordinator_subjects"("coordinator_id", "subject_id");

-- AddForeignKey
ALTER TABLE "coordinator_subjects" ADD CONSTRAINT "coordinator_subjects_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "coordinators"("coordinator_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_subjects" ADD CONSTRAINT "coordinator_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;
