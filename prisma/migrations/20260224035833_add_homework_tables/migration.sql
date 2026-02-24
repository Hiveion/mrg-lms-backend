-- CreateEnum
CREATE TYPE "HomeworkType" AS ENUM ('QUIZ', 'FILE');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('FIXED_DATE', 'RELATIVE');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'SHORT', 'FILE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'LATE', 'PENDING');

-- CreateTable
CREATE TABLE "homeworks" (
    "homework_id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "HomeworkType" NOT NULL DEFAULT 'FILE',
    "file_url" TEXT,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "deadline_type" "DeadlineType" NOT NULL DEFAULT 'FIXED_DATE',
    "deadline_date" TIMESTAMP(3),
    "deadline_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homeworks_pkey" PRIMARY KEY ("homework_id")
);

-- CreateTable
CREATE TABLE "homework_questions" (
    "question_id" SERIAL NOT NULL,
    "homework_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "correct_answer" TEXT,

    CONSTRAINT "homework_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "homework_submissions" (
    "submission_id" SERIAL NOT NULL,
    "homework_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "total_marks_awarded" DOUBLE PRECISION,
    "feedback" TEXT,
    "submission_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "submission_answers" (
    "answer_id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer_text" TEXT,
    "marks_awarded" DOUBLE PRECISION,

    CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("answer_id")
);

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_questions" ADD CONSTRAINT "homework_questions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homeworks"("homework_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homeworks"("homework_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "homework_submissions"("submission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "homework_questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;
