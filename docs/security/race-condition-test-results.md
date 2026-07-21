# Race Condition Test Results — mrg-lms-backend

Executed against: local instance (`http://localhost:3001`) + local Postgres (Docker), seeded DB.
Methodology: `race-condition` skill — bursts of 10-20 concurrent identical requests per target,
3 trials per item on freshly-reset state, verified against actual DB rows (not just HTTP codes).
Full raw request/response logs and per-trial DB snapshots: `race-condition-raw-logs.md`.

Plan executed: `docs/security/race-condition-test-plan.md` (all 12 items).

## Summary

We tested what happens when the same action gets sent to the app many times at once — like
20 clicks landing in the same instant instead of one after another. A well-built app handles
that gracefully; ours mostly didn't.

**Out of 12 things tested, 9 showed a real problem.** They fall into three buckets:

1. 🔴🟠 **The app let something happen more times than it should have (6 cases)** — this is the
   serious bucket. A class that only had room for 1 more student let in 10 at once. A homework
   assignment got submitted 20 times by the same student. The system generated dozens of
   duplicate invoices for the same student in the same month. A user got approved *and*
   rejected at the same time, with both actions reporting success. These are real bugs that
   could cost money (double billing, capacity breaches) or corrupt records.

2. 🟡 **The app crashed instead of failing politely (4 cases)** — good news first: in these
   cases, the database's own safety rules correctly stopped the duplicate from being saved.
   The bad news: the app didn't check for that safety rule tripping, so instead of a clean
   "you already did this" message, most of the extra requests crashed with a raw server error.
   Not a data problem, but a bad experience — and the kind of thing that happens for real
   whenever a user double-clicks or their app retries a slow request.

3. ✅ **No problem found (3 cases)** — we suspected these were risky based on reading the code,
   but testing them directly showed they hold up fine under pressure. Good to know, and cheap
   to double check periodically, but not something to fix urgently.

🚨 **The single worst issue:** a class enrollment limit test. We set a class to allow exactly
1 more student, then had 10 students try to join at the same moment. All 10 got in, every
single time we tried it. Zero were turned away. This is the clearest, most reproducible bug
in the whole set and the first thing worth fixing.

See the priority-ranked technical breakdown below for exact file locations and suggested fixes,
and `race-condition-raw-logs.md` for the full evidence (exact requests sent, responses received,
before/after database state) behind every claim in this report.

## Legend

| Icon | Meaning |
|---|---|
| 🔴 | **Critical** — confirmed data duplication / integrity breach |
| 🟠 | **High** — confirmed business-logic bypass |
| 🟡 | **Medium** — confirmed bug, but crash/error-handling only (no data corruption) |
| ✅ | **Clean** — tested, no bug found |
| 🔵 | **Theoretical** — code is vulnerable on paper but did not reproduce in testing |

## Summary table

| # | Finding | Severity | Confirmed? | Impact |
|---|---|:---:|---|---|
| 1 | Homework double submission | 🔴 | **YES (3/3)** | Data duplication — 20/20 dup rows every trial |
| 2 | Duplicate invoice generation | 🔴 | **YES (3/3)** | Data duplication — double billing, 15/45/33/39 dup invoices |
| 3 | Discussion like toggle race | 🟡 | **YES (3/3)**, different mechanism | Unhandled 500s (18-19/20), no data duplication |
| 4 | Duplicate reschedule request | 🔴 | **YES (3/3)** | Data duplication — 18-20/20 dup PENDING rows |
| 5 | User approval/rejection race | 🟠 | **YES (3/3)** | Business-logic bypass — approve+reject both "succeed" |
| 6 | Enrollment capacity overshoot | 🔴 | **YES (3/3)** | Data integrity — 10/10 succeed on a 1-slot class, every trial |
| 7 | Rating average lost-update | 🔵 | **NOT REPRODUCED (0/3)** | Theoretical only — code is vulnerable but race window too narrow in practice |
| 8 | Rating like counter drift | 🟡 | **YES (3/3)**, different mechanism | Unhandled 500s (17-19/20), counter itself stayed accurate |
| 9 | Payout double-generation | 🟡 | **YES (3/3)**, different mechanism | Unhandled 500s (14/15), no duplication (DB constraint held) |
| 10 | Invite/create-user email race | 🟡 | **YES (3/3)**, different mechanism | Unhandled 500s (8-14/15), no duplicate user rows |
| 11 | Class assignment availability corruption | 🟡 | **NOT REPRODUCED as corruption (0/3)** | Downgraded — Postgres cleanly rolls back the losing transaction; real bug is an unhandled 500, not corrupted data |
| 12a | Session feedback auto-complete | ✅ | **NOT A BUG (0/2)** | Behaves correctly under concurrency |
| 12b | Invoice status transition race | ✅ | **NOT A BUG (0/3)** | PAID always wins over auto-OVERDUE by design; no inconsistency found |

**9 of 12 planned items produced a confirmed, reproducible finding.** 4 🔴 critical data-duplication bugs, 1 🟠 high business-logic bypass, 5 🟡 medium crash/error-handling bugs (4 confirmed + 1 downgraded-from-critical), 1 🔵 theoretical-only gap, 2 ✅ clean.

## Priority-ranked findings requiring fixes

### 🔴 P0 — Critical (real money/data impact, trivially exploitable)

**🔴 1. Enrollment capacity overshoot** — `src/Services/enrollment.service.ts:32-34`
A class with `maxStudentCount=1` accepted **10/10** concurrent enrollments in every trial (100% success rate, zero failures). This is the most severe finding: an attacker or just a popular class at signup time could blow through capacity limits arbitrarily. The capacity check (`currentStudentCount >= maxStudentCount`) is a plain read before the transaction; the transaction only guarantees the *insert* is atomic, not the capacity check itself.
**Fix:** move the capacity check inside the transaction using a conditional atomic update, e.g. `UPDATE classes SET current_student_count = current_student_count + 1 WHERE id = ? AND current_student_count < max_student_count RETURNING *`, and only proceed with the enrollment create if a row was returned. Alternatively add a DB check constraint plus retry-on-conflict logic.

**🔴 2. Duplicate invoice generation** — `src/Services/invoice.service.ts:56-96`
15 concurrent `POST /invoices/generate` calls for one month produced up to **15 duplicate invoices per student** (45 total for 3 students) in trial 1; 39 and 33 in trials 2-3. Real double-billing risk — this endpoint is meant to run as a scheduled/admin batch job, exactly the kind of operation liable to get triggered twice (retry, double-click, concurrent cron).
**Fix:** add a DB unique constraint on `(studentId, month)` on the `Invoice` model, and wrap the check+create in a transaction or catch P2002 and treat as "already generated."

**🔴 3. Homework double submission** — `src/Services/homework.service.ts:433-509`
20/20 concurrent submits for the same student+homework all succeeded, creating 20 duplicate `SUBMITTED` rows every trial. Breaks grading integrity (multiple submissions with no defined "latest" semantics) and could be used to spam storage/notifications.
**Fix:** add a DB unique constraint on `(homeworkId, studentId)` on `HomeworkSubmission`, and either upsert or catch P2002 and return a clean "already submitted" error.

**🔴 4. Duplicate pending reschedule request** — `src/Services/reschedule.service.ts:54-60`
18-20/20 concurrent requests all created separate PENDING reschedule requests for the same session+student. Confuses the approval workflow (tutor could approve/decline duplicates independently, causing inconsistent state).
**Fix:** add a DB unique constraint (or partial unique index where `status='PENDING'`) on `(sessionId, studentId)`, catch P2002 as "already pending."

### 🟠 P1 — High (business-logic integrity, no direct duplication but wrong outcomes)

**🟠 5. User approval/rejection race** — `src/Services/admin.service.ts:515-560`
Firing 10 concurrent approve + 10 concurrent reject calls at the same PENDING user resulted in **all 20 requests reporting success** in 2 of 3 trials (trial 3 showed partial protection: 2/10 approves correctly got 409). `rejectUser` has *no* status guard at all — it unconditionally sets `INACTIVE` regardless of current state. `approveUser`'s guard is a plain read-then-write with no locking, so it's unreliable under concurrency.
**Fix:** use an atomic conditional update for both operations, e.g. `UPDATE users SET status='ACTIVE' WHERE id=? AND status='PENDING'` (Prisma: `updateMany` with a `where: { status: 'PENDING' }` guard, check the returned count), and apply the same guard to `rejectUser`.

### 🟡 P2 — Medium (availability/error-handling bugs, no data corruption confirmed)

**🟡 6. Unhandled 500s under concurrency (4 related findings, same root cause)** — affects:
- Discussion/reply like toggle (`discussion.service.ts:136-174`) — 18-19/20 requests
- Rating like toggle (`rating.service.ts:265-297`) — 17-19/20 requests
- Payout generation (`payout.service.ts:246-293`) — 14/15 requests
- Invite/create-user (`admin.service.ts:79-163`) — 8-14/15 requests

In all four cases, the underlying data stayed correct (DB unique/primary-key constraints held, no duplication), but the losing requests in the race crash with a raw, unhandled `{"statusCode":500,"message":"Internal server error"}` instead of a clean 400/409. This is a real UX and information-disclosure-adjacent bug (unhandled Prisma exceptions can leak stack details in less hardened environments) at scale — any legitimate double-click or retry-on-timeout from a real user would surface as a server error.
**Fix:** wrap the `create`/`update` calls in a try/catch for Prisma error code `P2002` (unique constraint violation) and return a clean `ConflictException` ("already liked" / "already exists" / "already generated") instead of letting it bubble up as a 500.

**🟡 7. Class assignment availability race** — `src/Services/admin.service.ts:183-324`
Two admins assigning overlapping-schedule classes concurrently do **not** corrupt availability data — Postgres correctly serializes the two transactions and rolls back the loser cleanly (confirmed empirically 3/3: no orphaned class/enrollment rows, no incorrect availability state). The real, lower-severity bug is that the losing request gets an unhandled 500 instead of a clean "scheduling conflict, please retry" message.
**Fix:** same P2002/conflict-handling pattern as above, or catch the transaction failure and return a clean 409 with a retry hint.

## Non-findings (tested, no bug)

- 🔵 **Rating average lost-update** (`rating.service.ts`) — code is a textbook non-transactional read-compute-write pattern and is theoretically vulnerable, but 3/3 trials with 10-way concurrency produced a mathematically correct average every time. Likely due to how quickly local DB round-trips complete relative to Node's event loop scheduling; the vulnerability may still be reachable under different timing conditions (e.g. slower DB, higher fan-out), so it's not disproven — just not practically triggered here. Low priority; consider fixing opportunistically (wrap in `$transaction`, or better, compute the average via a single `AVG()`/`COUNT()` SQL aggregate inside the same transaction as the rating write) since the fix is cheap regardless.
- ✅ **Session feedback auto-complete** — behaves correctly under concurrent submission from different students; session status flips to COMPLETED exactly once.
- ✅ **Invoice status transition race** — `updateStatus(PAID)` always wins over the automatic SENT→OVERDUE sync regardless of timing, because the OVERDUE conversion only applies when the *caller* explicitly requests `SENT`. No inconsistency found.

## Notes on plan accuracy vs actual results

The original plan (written from static code review) got the *existence* of gaps right but not always the *mechanism*:
- Items assumed to have "no DB constraint" and predicted silent duplication (discussion/reply likes) actually do have a constraint (`@@id` composite primary key, not `@@unique` — missed in the first grep pass) — real bug is unhandled 500s, not duplication.
- Item 11 (assignClass) was predicted to risk silent data corruption; empirically it does not — Postgres's transaction handling protects it. Real bug is the same unhandled-500 pattern.
- Item 7 (rating average) was correctly identified as a theoretical gap but did not reproduce under test.

This is a useful validation of the "test before trusting a static read" principle applied throughout — several severity assessments changed after empirical testing.
