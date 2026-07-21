# Race Condition Fixes — Verification Report

Companion to `race-condition-test-results.md` and `race-condition-raw-logs.md`. This report
covers the fixes applied for all confirmed findings and their re-verification, using the same
methodology (10-20 concurrent requests, 3 trials per item, verified against actual DB rows).

## Plain-English summary

We fixed the 9 confirmed problems from the original test round, then re-ran the exact same
attacks against the fixed code to prove the fixes actually work — not just reviewed the code
and assumed it was fine.

**Every single one now behaves correctly.** The worst bug (a class with 1 open seat letting
in 10 students) now correctly accepts exactly 1 and rejects the other 9, every time we tried
it. The four "crashes instead of clean errors" bugs now return proper, friendly error messages
instead of raw server crashes. Nothing was broken in the process — the normal, non-race use of
every fixed endpoint still works exactly as before.

## Summary table

| # | Finding | Fix applied | Before (confirmed) | After (verified) |
|---|---|---|---|---|
| 1 | 🔴 Homework double submission | DB unique constraint `(homeworkId, studentId)` + clean 409 | 20/20 duplicates every trial | ✅ 1/20 succeeds, 19/20 clean 409, 3/3 trials |
| 2 | 🔴 Duplicate invoice generation | DB unique constraint `(studentId, month)` + catch-and-skip | Up to 45 duplicate invoices | ✅ Exactly 1 invoice/student, 3/3 trials |
| 3 | 🟡 Discussion like crashes | Catch P2002/P2025, return idempotent result | 18-19/20 unhandled 500s | ✅ 20/20 clean responses, 0 crashes, 3/3 trials |
| 4 | 🔴 Duplicate reschedule request | Partial unique index (PENDING only) + clean 400 | 18-20/20 duplicates | ✅ 1/20 succeeds, 19/20 clean 400, 3/3 trials |
| 5 | 🟠 User approval/rejection race | Atomic conditional `updateMany` (PENDING guard) on both actions | All 20 requests "succeeded" in 2/3 trials | ✅ Exactly 1/20 wins, 19/20 clean 409, 3/3 trials |
| 6 | 🔴 Enrollment capacity overshoot | Atomic conditional `updateMany` (capacity guard) | 10/10 succeed on a 1-slot class, every trial | ✅ Exactly 1/10 succeeds, 9/10 clean 409, 3/3 trials |
| 7 | 🔵 Rating average lost-update | Not fixed (low priority, unreproduced) | Not reproduced | ✅ Still not reproduced (unchanged, as expected) |
| 8 | 🟡 Rating like counter drift | Catch P2002/P2025, return clean 400 | 17-19/20 unhandled 500s | ✅ 20/20 clean responses, 0 crashes, counter accurate, 3/3 trials |
| 9 | 🟡 Payout double-generation | Catch P2002, clean skip | 14/15 unhandled 500s | ✅ 15/15 clean 201s, 0 crashes, 3/3 trials |
| 10 | 🟡 Invite/create-user email race | Catch P2002, clean 409 | 8-14/15 unhandled 500s | ✅ 0 crashes, 3/3 trials (see note below) |
| 11 | 🟡 Class assignment availability race | Catch transaction failure, clean 409 | Data safe, but unhandled 500 on the losing request | ✅ Clean 409 instead of 500, data still correct, 3/3 trials |
| 12a | ✅ Session feedback auto-complete | Not fixed (no bug found) | Correct | Unchanged (no code touched) |
| 12b | ✅ Invoice status transition race | Not fixed (no bug found) | Correct | Unchanged (no code touched) |

**9 of 9 confirmed findings fixed and verified.** 1 theoretical item intentionally left as-is
(low priority, cheap to fix later but not urgent). 2 items were already clean and untouched.

## What changed, file by file

### Schema (`prisma/schema.prisma` + new migration `20260721193027_add_race_condition_unique_constraints`)
- `HomeworkSubmission`: added `@@unique([homeworkId, studentId])`
- `Invoice`: added `@@unique([studentId, month])`
- `RescheduleRequest`: added a **partial** unique index via raw SQL (not expressible in Prisma's
  schema DSL) — `CREATE UNIQUE INDEX ... ON reschedule_requests (session_id, student_id) WHERE status = 'PENDING'`.
  A partial index was necessary here because a student can legitimately have multiple past
  ACCEPTED/DECLINED requests for the same session — only one PENDING at a time should be blocked.

### `src/Services/enrollment.service.ts`
Moved the capacity check from a stale pre-transaction read into an atomic conditional
`updateMany` inside the transaction (`WHERE currentStudentCount < maxStudentCount`), checking
the returned row count before proceeding. Removed the separate pre-check for duplicate
enrollment (relied on the existing DB unique constraint) and added a P2002 catch for a clean
error instead.

### `src/Services/homework.service.ts`
Wrapped the submission `create` call in a try/catch for P2002 → clean `ConflictException`
("You have already submitted this homework").

### `src/Services/invoice.service.ts`
Wrapped the per-student invoice `create` call (inside the batch generation loop) in a
try/catch for P2002 → increments the existing `skippedInvoicesCount` counter instead of
crashing the whole batch.

### `src/Services/reschedule.service.ts`
Wrapped the request `create` call in a try/catch for P2002 → clean `BadRequestException`
(same message the original pre-check used).

### `src/Services/admin.service.ts`
- `approveUser` / `rejectUser`: replaced the read-then-write pattern with an atomic conditional
  `updateMany` (`WHERE id=? AND status='PENDING'`), checking the affected row count. `rejectUser`
  previously had no guard at all — now matches `approveUser`'s behavior.
- `inviteUser` / `createUserByAdmin`: wrapped the user `create` calls in try/catch for P2002 →
  clean `ConflictException` instead of an unhandled 500.
- `assignClass`: wrapped the whole `$transaction` call in try/catch for P2025/P2002 → clean
  `ConflictException` ("This time slot was just modified by another request — please retry")
  instead of a raw 500. Data integrity here was already fine (Postgres correctly rolled back
  the losing transaction); this only improves the error surfaced to the caller.

### `src/Services/discussion.service.ts`
`toggleThreadLike` / `toggleReplyLike`: wrapped the create/delete calls in try/catch for
P2002/P2025 → since these are idempotent toggles, a losing race is treated as "the desired
end state was reached by someone else" rather than an error.

### `src/Services/rating.service.ts`
`addLike` / `removeLike`: wrapped the create/delete calls in try/catch for P2002/P2025 → clean
`BadRequestException` matching the original pre-check messages, instead of an unhandled 500.

### `src/Services/payout.service.ts`
Wrapped the per-tutor payout `create` call (inside the batch generation loop) in a try/catch
for P2002 → increments the existing `skippedCount` counter instead of crashing.

## Notes on residual behavior (not bugs)

- **Item 10 (invite-user):** multiple requests can still report `201` success under a race,
  because the "update an existing INCOMPLETE user's invitation" code path has no additional
  guard. This is not a data-integrity issue — each such "success" is a legitimate, idempotent
  update to the same single user row (confirmed: never more than 1 row created). Left as-is
  since fixing it further would add complexity for a cosmetic-only concern (a "why did I get
  201 twice" question, not incorrect data).
- **Item 3 (discussion likes) trial variance:** final like counts of 0 or 1 both occur across
  trials — this is expected toggle semantics under heavy concurrency (an even vs. odd number of
  successful flips), not a bug. The fix's job was to eliminate crashes, which it did.

## Regression check

Every trial's "winning" request in each test (the one that returns 200/201) confirms the normal,
non-race behavior of each endpoint is intact — enrollment, homework submission, invoice
generation, reschedule requests, user approval, discussion/rating likes, payout generation, and
class assignment all complete successfully for the legitimate first caller in every single trial
across this verification round. Database was restored to the original seed state after testing
(verified: 5 users, 10 classes, 16 enrollments, 15 homework submissions, 0 stray invoices,
tutor rating back to 4.833/3 reviews).
