# Race Condition Test Plan — mrg-lms-backend

Target: local instance at http://localhost:3001 (seeded DB). Never run against staging/prod.
Methodology: `race-condition` skill (~/.claude/skills/race-condition/SKILL.md) — single-endpoint
20-30x concurrent bursts, multi-endpoint timing-window races, confirm each hit ≥3x on fresh state.

Guardrail from the skill: no `&` background loops, no unbounded thread pools (cap concurrency
at ~30), no unbounded network calls.

## Priority order (based on code scan + schema constraint check)

### Tier 1 — no DB unique constraint, real double-write risk

1. **Homework double submission** — `HomeworkSubmission` has NO unique constraint on
   (homeworkId, studentId). `homework.service.ts:433-509` checks enrollment then creates,
   no existing-submission check, no transaction.
   - Test: same student, same homework, fire 20 concurrent `POST /homeworks/submit`.
   - Success = >1 submission row for the same (homeworkId, studentId) pair.

2. **Duplicate invoice generation** — `Invoice` has NO unique constraint on (studentId, month).
   `invoice.service.ts:56-96` — findFirst-then-create, no transaction.
   - Test: fire 10-20 concurrent `POST /invoices/generate` for the same student/month.
   - Success = >1 invoice row for the same student+month (double billing).

3. **Discussion/reply like toggle race** — `DiscussionLike`/`ReplyLike` have NO unique
   constraints. `discussion.service.ts:136-174` — check-then-create/delete.
   - Test: same user, same thread, fire concurrent `POST /discussions/:id/like`.
   - Success = >1 like row for same (userId, threadId), or like count diverges from row count.

4. **Duplicate pending reschedule request** — `RescheduleRequest` has NO unique constraint.
   `reschedule.service.ts:54-60` — findFirst-then-create.
   - Test: same session/student, fire concurrent `POST /reschedule/sessions/:sessionId`.
   - Success = >1 PENDING request row for the same session+student.

### Tier 2 — DB unique constraint exists, but check for lost-update / inconsistent counters

5. **Enrollment capacity overshoot** — `Enrollment` has unique (studentId, classId), so a
   single student can't double-enroll, but the CAPACITY check
   (`enrollment.service.ts:32-34`) is a stale read before the transaction. Different
   students racing for the last slot(s) can all pass.
   - Test: set a class to `maxStudentCount = currentCount + 1` (1 free slot), fire 10-20
     concurrent `POST /enrollments` from 10-20 *different* students.
   - Success = enrolled count ends up > maxStudentCount.

6. **Rating average lost-update** — `rating.service.ts:58-72/210-226/244-260` — read-all,
   compute average in JS, write back; no transaction.
   - Test: fire concurrent `POST /ratings` for the same tutor from different students.
   - Success = final `tutor.averageRating`/`totalReviews` doesn't match a fresh recomputation
     from the actual `Rating` rows (lost update).

7. **Rating like counter drift** — `RatingLike` has unique (userId, ratingId) so the like
   row itself is protected, but the separate `rating.likes` counter update
   (`rating.service.ts:265-327`) is not transactional with the create/delete.
   - Test: concurrent like/unlike toggles from same user; check `rating.likes` vs actual
     `RatingLike` row count for drift after the storm settles.

8. **Payout double-generation** — `TutorPayout` has unique (tutorId, month), so this should
   be DB-protected, but worth confirming: `payout.service.ts:246-293` findFirst-then-create
   with no transaction could still throw an unhandled P2002 under race rather than a clean
   409 — check for an unhandled-exception / 500 leak instead of silent duplication.
   - Test: fire concurrent `POST /payouts/generate` for the same tutor/month.
   - Success criteria = either a graceful single-winner (good) or an unhandled 500 stack
     trace leak (bug, lower severity than duplication but still worth flagging).

### Tier 3 — lower value / confirm only

9. **Session feedback → auto-complete session** — `session.service.ts:679-733`. Protected by
   unique (sessionId, studentId) on `SessionFeedback`, so double-submit itself is blocked;
   only the `feedbacksCount >= enrollmentsCount` completion check is non-atomic. Likely
   harmless (idempotent status flip). Test briefly, expect low/no impact — deprioritize.

10. **Invoice status transition races** (`invoice.service.ts:110-120, 207-226`) — time-based
    OVERDUE auto-flip vs manual PAID update racing. Harder to reliably reproduce (needs
    real time passage), do only if time permits.

## Out of scope for now
- Auth lockout / credential stuffing (`auth.service.ts`) — this is a missing-control finding,
  not a TOCTOU race; separate test category, not covered by this plan.

## Execution steps per target
1. Reset DB state relevant to the target (delete rows / re-seed) so each trial starts fresh.
2. Obtain a valid JWT for the relevant test user(s) via `POST /auth/login` (seeded users:
   alice.johnson@example.com / bob.martin@example.com / carol.white@example.com /
   robert.smith@mrg-lms.com / admin@mrg-lms.com, all password `password123`).
3. Write a small concurrent-request script (curl in a bounded loop with `wait`, or a short
   Node/Python script using Promise.all / asyncio.gather) — 20-30 requests fired as close to
   simultaneously as possible.
4. Inspect DB directly after each run (`docker exec ... psql`) to check row counts / values,
   not just HTTP response codes.
5. Repeat ≥3 times per target on fresh state before calling a finding confirmed.
6. Record: target, request count fired, successes observed, DB state before/after, reproducible
   y/n.

## Reporting
For each Tier 1/2 finding that reproduces: file:line of the gap, whether a DB constraint exists,
suggested fix (wrap check+write in `prisma.$transaction`, or add a DB unique constraint /
conditional `updateMany where:` guard), and severity (money/data-integrity impact vs cosmetic).
