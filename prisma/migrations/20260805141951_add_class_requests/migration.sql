-- CreateEnum
CREATE TYPE "ClassRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "class_requests" (
    "class_request_id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "class_name" TEXT,
    "grade" TEXT,
    "student_ids" INTEGER[],
    "schedule" JSONB NOT NULL,
    "start_date" TEXT,
    "frequency" INTEGER,
    "number_of_weeks" INTEGER,
    "create_sessions" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClassRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "resulting_class_id" INTEGER,
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_requests_pkey" PRIMARY KEY ("class_request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_requests_resulting_class_id_key" ON "class_requests"("resulting_class_id");

-- AddForeignKey
ALTER TABLE "class_requests" ADD CONSTRAINT "class_requests_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("tutor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_requests" ADD CONSTRAINT "class_requests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_requests" ADD CONSTRAINT "class_requests_resulting_class_id_fkey" FOREIGN KEY ("resulting_class_id") REFERENCES "classes"("class_id") ON DELETE SET NULL ON UPDATE CASCADE;
