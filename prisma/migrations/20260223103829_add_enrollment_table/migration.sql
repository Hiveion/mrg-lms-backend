-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('REQUESTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "enrollments" (
    "enrollment_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "enrollment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_price" DOUBLE PRECISION NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "confirmation_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_class_id_key" ON "enrollments"("student_id", "class_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;
