-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "tutor_availabilities" (
    "availability_id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "day" "WeekDay" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_availabilities_pkey" PRIMARY KEY ("availability_id")
);

-- CreateTable
CREATE TABLE "student_availabilities" (
    "availability_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "day" "WeekDay" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_availabilities_pkey" PRIMARY KEY ("availability_id")
);

-- AddForeignKey
ALTER TABLE "tutor_availabilities" ADD CONSTRAINT "tutor_availabilities_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("tutor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_availabilities" ADD CONSTRAINT "student_availabilities_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;
