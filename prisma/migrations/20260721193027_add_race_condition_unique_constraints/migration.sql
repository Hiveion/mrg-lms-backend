-- Race-condition fixes: enforce at the DB level what the app previously only checked
-- with a non-atomic read-then-write.

-- HomeworkSubmission: one submission per (homework, student)
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_student_id_key" UNIQUE ("homework_id", "student_id");

-- Invoice: one invoice per (student, month)
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_month_key" UNIQUE ("student_id", "month");

-- RescheduleRequest: only one PENDING request per (session, student) at a time.
-- Partial unique index (not expressible via Prisma's @@unique) — students may still have
-- multiple past ACCEPTED/DECLINED requests for the same session.
CREATE UNIQUE INDEX "reschedule_requests_session_id_student_id_pending_key"
  ON "reschedule_requests" ("session_id", "student_id")
  WHERE "status" = 'PENDING';
