-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "extra_class_rate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "session_feedbacks" (
    "feedback_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_feedbacks_pkey" PRIMARY KEY ("feedback_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_feedbacks_session_id_student_id_key" ON "session_feedbacks"("session_id", "student_id");

-- AddForeignKey
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("tutor_id") ON DELETE CASCADE ON UPDATE CASCADE;
