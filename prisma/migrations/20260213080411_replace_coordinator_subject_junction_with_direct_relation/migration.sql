
-- DropForeignKey
ALTER TABLE "coordinator_subjects" DROP CONSTRAINT "coordinator_subjects_coordinator_id_fkey";

-- DropForeignKey
ALTER TABLE "coordinator_subjects" DROP CONSTRAINT "coordinator_subjects_subject_id_fkey";

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "coordinator_id" INTEGER;

-- DropTable
DROP TABLE "coordinator_subjects";

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "coordinators"("coordinator_id") ON DELETE SET NULL ON UPDATE CASCADE;
