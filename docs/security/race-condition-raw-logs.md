# Race Condition Test — Raw Logs

Companion to `race-condition-test-results.md`. Raw commands, HTTP status tallies, and DB
query output captured during test execution. All tests ran against local Docker Postgres
(`localhost:5433`) and local NestJS instance (`localhost:3001`), seeded DB. Concurrency capped
at 10-20 parallel requests per the skill's guardrail (max ~30 workers).

Test users: `admin@mrg-lms.com`, `alice.johnson@example.com` (student id 1), `bob.martin@example.com`
(student id 2), `carol.white@example.com`, `robert.smith@mrg-lms.com` (tutor id 1) — all
password `password123`. Additional throwaway users (`race.rater.1..10@example.com`,
`race.test.pending@example.com`, `race.invite.test1@gmail.com`) were created for tests needing
multiple distinct actors, and deleted after each test completed.

---

## 🔴 Item 1 — Homework double submission

Endpoint: `POST /homeworks/submit`, actor: Bob (studentId=2), homeworkId=9 (no prior submission).
Concurrency: 20.

```
Trial 1: BEFORE count=0 → 20x POST fired → AFTER count=20, all 20 rows status=SUBMITTED
         HTTP codes: 20x 201
Trial 2: BEFORE count=0 (reset via DELETE) → AFTER count=20
Trial 3: BEFORE count=0 (reset) → AFTER count=20
```
Sample AFTER rows (trial 1): 20 distinct `submission_id` values (16-35), same `homework_id=9`,
same `student_id=2`, all `status=SUBMITTED`, timestamps within ~0.5s of each other.

**Result: 20/20 duplicate rows, 3/3 trials. Fully reproducible.**

---

## 🔴 Item 2 — Duplicate invoice generation

Endpoint: `POST /invoices/generate`, body `{"month":"2026-08"}` (fresh month, 3 students with
active enrollments). Concurrency: 15.

```
Trial 1: BEFORE count=0 → 15x POST fired → AFTER: student 1=15, student 2=15, student 3=15 (45 total)
         HTTP codes: 15x 201
Trial 2: BEFORE count=0 (reset) → AFTER count=39 total
Trial 3: BEFORE count=0 (reset) → AFTER count=33 total
```
Note: exact duplicate count varies per trial (39, 33 vs. the "clean" 45) due to timing —
some concurrent findFirst-then-create calls do occasionally see a just-committed sibling row
and skip, but never reliably (should be exactly 3 invoices total — one per student — every time).

**Result: severe duplication, 3/3 trials. Fully reproducible, though magnitude varies.**

---

## 🟡 Item 3 — Discussion thread like toggle race

Endpoint: `POST /discussions/1/like`, actor: Carol, no prior like on thread 1. Concurrency: 20.

```
Trial 1: BEFORE count=0 → 20x POST fired → AFTER count=1 (correct — DB constraint held)
         HTTP codes: 1x 201, 19x 500 {"statusCode":500,"message":"Internal server error"}
Trial 2: BEFORE count=0 (reset) → AFTER count=1
         HTTP codes: 1x 201, 19x 500
Trial 3: BEFORE count=0 (reset) → AFTER count=0 (!)
         HTTP codes: 2x 201, 18x 500
```
Trial 3 detail: two requests got 201 (one create, one delete) because the toggle nature of the
endpoint means a request arriving slightly later can see the just-created like and flip it back
off — net result 0 likes, still not a data-integrity bug (each transition was individually valid),
but demonstrates the endpoint's behavior is nondeterministic under concurrent access.

Schema correction made during testing: `DiscussionLike`/`ReplyLike` use `@@id([userId, threadId])`
(composite primary key), not `@@unique` — missed by the initial `grep "@@unique"` pass in the
original plan. This constraint is what prevents duplicate rows; the 500s are unhandled P2002s.

**Result: DB integrity holds 3/3, but 18-19/20 requests crash with unhandled 500 every trial.**

---

## 🔴 Item 4 — Duplicate pending reschedule request

Endpoint: `POST /reschedule/sessions/2`, actor: Alice (studentId=1), no prior pending request
for session 2. Concurrency: 20.

```
Trial 1: BEFORE count=0 → 20x POST fired → AFTER count=20
         HTTP codes: 20x 201
Trial 2: BEFORE count=0 (reset) → AFTER count=20
Trial 3: BEFORE count=0 (reset) → AFTER count=18
```

**Result: 18-20/20 duplicate PENDING rows, 3/3 trials. Fully reproducible.**

---

## 🟠 Item 5 — User approval/rejection race

Endpoint: 10x concurrent `POST /admin/approve-user/:id` + 10x concurrent
`POST /admin/reject-user/:id`, same target user (test user inserted directly as PENDING,
user_id=7). Actor: Admin.

```
Trial 1: BEFORE status=PENDING → AFTER status=INACTIVE
         approve codes: 10x 201  |  reject codes: 10x 201
         (all approve responses: {"message":"User ... has been approved", status:"ACTIVE"})
         (all reject responses:  {"message":"User ... has been rejected", status:"INACTIVE"})
Trial 2: BEFORE reset to PENDING → AFTER status=INACTIVE
         approve codes: 10x 201  |  reject codes: 10x 201
Trial 3: BEFORE reset to PENDING → AFTER status=INACTIVE
         approve codes: 8x 201, 2x 409  |  reject codes: 10x 201
```
`rejectUser` has no status guard at all (unconditional `update` to INACTIVE), which is why
reject always succeeds 10/10 in every trial. `approveUser`'s `status !== PENDING` guard only
caught 2/10 races in trial 3 — the other two trials show it caught 0/10.

**Result: guard fails to prevent concurrent approve+reject in the vast majority of requests,
3/3 trials. Reproducible, severity high (business-logic bypass).**

---

## 🚨🔴 Item 6 — Enrollment capacity overshoot (worst finding)

Endpoint: `POST /enrollments`, 10 distinct throwaway students (`race.rater.1..10`,
studentIds 4-13) against a purpose-built class (`class_id=17`, `maxStudentCount=1`,
`currentStudentCount=0`). Concurrency: 10 (one request per distinct student).

```
Trial 1: BEFORE currentStudentCount=0, maxStudentCount=1
         10x POST fired → HTTP codes: 10x 201
         AFTER: enrollment row count=10, currentStudentCount field=10
Trial 2: reset (delete enrollments, currentStudentCount=0) → 10x 201 → count=10
Trial 3: reset → 10x 201 → count=10
```

**Result: 10/10 succeed in every trial (0% rejection rate) on a class with exactly 1 free
slot. Most severe finding — 100% reproducible, 10x capacity overshoot every time.**

---

## 🔵 Item 7 — Rating average lost-update

Endpoint: `POST /ratings`, 10 distinct throwaway students (`race.rater.1..10`) rating the same
tutor (tutor_id=1) concurrently, each with `overallRating: 5`. Concurrency: 10.

```
Trial 1: BEFORE avg=4.833333333333333, reviews=3 (seed data)
         10x POST fired → HTTP codes: 10x 201
         AFTER (app-reported): avg=4.961538461538462, reviews=13
         AFTER (recomputed from actual rows): avg=4.961538461538462, count=13
         → MATCH, no lost update
Trial 2: reset ratings to seed state → same result, exact match
Trial 3: reset → same result, exact match
```

**Result: NOT reproduced in 3/3 trials. Code is a textbook non-transactional
read-all-compute-write pattern (confirmed via source read) and is theoretically vulnerable,
but the actual race window (two sequential `await`ed DB round-trips within one request handler,
against a fast local DB) was never wide enough to produce a lost update with 10-way concurrency.**

---

## 🟡 Item 8 — Rating like counter drift

Endpoint: `POST /ratings/1/like`, actor: race.rater.1, no prior like on rating_id=1 (seed
had likes=2 on this rating already). Concurrency: 20.

```
Trial 1: BEFORE likes=2 → 20x POST fired → AFTER likes=3 (correct, +1)
         actual RatingLike rows for this user/rating: 1 (correct)
         HTTP codes: 1x 201, 19x 500
Trial 2: reset (delete like row, likes=2) → AFTER likes=3, actual rows=1
         HTTP codes: 1x 201, 19x 500
Trial 3: reset → AFTER likes=3, actual rows=1
         HTTP codes: 1x 201, 2x 400, 17x 500
```
`RatingLike` has a real unique constraint (`user_id_review_id` unique index, confirmed via
`\d rating_likes`), and the `likes: { increment: 1 }` update is DB-atomic — counter integrity
held in all 3 trials. Only the unhandled-500 pattern reproduced.

**Result: no counter drift, 3/3. Unhandled 500 crashes 17-19/20 requests, 3/3 trials.**

---

## 🟡 Item 9 — Payout double-generation

Endpoint: `POST /payouts/generate`, body `{"month":"2026-07"}` — month with 3 pre-existing
COMPLETED sessions for tutor_id=1 (all from seed data). Concurrency: 15.

```
Trial 1: BEFORE count=0 → 15x POST fired → AFTER count=1 (correct, only one payout row)
         HTTP codes: 1x 201, 14x 500
Trial 2: reset (delete payout + items) → AFTER count=1
         HTTP codes: 1x 201, 14x 500
Trial 3: reset → AFTER count=1
         HTTP codes: 1x 201, 14x 500
```
`TutorPayout` has a real unique constraint on `(tutorId, month)` — confirmed no duplication
across all 3 trials. Matches the plan's prediction exactly.

**Result: no duplication (constraint holds), 3/3. Unhandled 500 crashes 14/15 requests, 3/3 trials.**

---

## 🟡 Item 10 — Duplicate invite/create-user email race

Endpoint: `POST /admin/invite-user`, body `{"email":"race.invite.test1@gmail.com","userType":"STUDENT"}`
(Gmail required by the endpoint's validation), fresh email each trial. Concurrency: 15.

```
Trial 1: BEFORE count=0 → 15x POST fired → AFTER count=1 user row (correct, no duplicate)
         HTTP codes: 2x 201, 13x 500
Trial 2: reset (delete user) → AFTER count=1
         HTTP codes: 7x 201, 8x 500
Trial 3: reset → AFTER count=1
         HTTP codes: 7x 201, 8x 500
```
Multiple 201s per trial (not just 1) because `inviteUser`'s create-or-update branching means a
request that loses the create race can still succeed by finding the already-created INCOMPLETE
user and updating it — that update path has no additional race guard, so several requests can
each "successfully" update the same row. No duplicate user rows were created in any trial
(protected by `User.email @unique`).

**Result: no duplicate user rows (constraint holds), 3/3. Unhandled 500s in 8-14/15 requests, 3/3 trials.**

---

## 🟡 Item 11 — Class assignment availability corruption

Setup: tutor Robert (tutor_id=1), Monday availability `14:00-18:00` (seed state). Two concurrent
`POST /admin/assign-class` calls with overlapping schedule slots:
- Call A: Monday 14:00-15:00 (60 min), student Alice, subject Mathematics
- Call B: Monday 15:00-16:00 (60 min), student Bob, subject Physics

Expected correct sequential result: `Monday 16:00-18:00` (both carve-outs applied).

```
Trial 1: A → 500 (transaction rolled back, no orphaned class/enrollment for A)
         B → 201 (class 12 "Physics - Robert" created correctly)
         Resulting availability: Monday 14:00-15:00, Monday 16:00-18:00
         → CORRECT for "only B's carve-out applied" (A fully rolled back)
Trial 2: reset (delete class 12, restore Monday 14:00-18:00)
         A → 201 (class 13 "Mathematics - Robert" created)
         B → 500 (rolled back, no "Physics - Robert" class exists)
         Resulting availability: Monday 15:00-18:00
         → CORRECT for "only A's carve-out applied"
Trial 3: reset (delete class 13, restore Monday 14:00-18:00)
         A → 201, B → 500 (same pattern as trial 2)
         Resulting availability: Monday 15:00-18:00 → CORRECT
```
In every trial, exactly one of the two concurrent transactions failed outright and rolled back
completely (verified: no orphaned class/enrollment rows for the losing call), while the other
succeeded and produced a mathematically correct availability result. Postgres's transaction
isolation prevented the silent corruption the original plan hypothesized.

**Result: NOT reproduced as data corruption, 3/3 (data always ends up correct). The actual bug
is that the losing call surfaces an unhandled 500 instead of a clean "scheduling conflict, retry"
response.**

---

## ✅ Item 12a — Session feedback auto-complete race

Setup: session_id=6 (class 3, 2 active enrollments: Alice studentId=1, Bob studentId=2), status
reset to SCHEDULED before each trial. Two concurrent tutor (Robert) feedback submissions for the
two different students.

```
Trial 1: BEFORE status=SCHEDULED → both feedback POSTs → HTTP: 201, 201
         AFTER: status=COMPLETED, feedback row count=2 (correct)
Trial 2: reset → both feedback POSTs → HTTP: 201, 201 → status=COMPLETED (correct)
```

**Result: behaves correctly, 2/2 trials run (deprioritized Tier 3 item, 2 trials deemed
sufficient given consistent clean results). No bug found.**

---

## ✅ Item 12b — Invoice status transition race

Setup: invoice_id=118 (test invoice), status=SENT, due_date=2026-06-15 (in the past relative
to test date 2026-07-21). Concurrent `GET /invoices` (triggers `syncOverdueStatus` bulk
SENT→OVERDUE flip) + `PATCH /invoices/118/status` body `{"status":"PAID"}`.

```
Trial 1: both fired concurrently → HTTP: 200, 200 → final status=PAID
Trial 2: reset to SENT → both fired → final status=PAID
Trial 3: reset to SENT → both fired → final status=PAID
```
Explained by code logic: `updateStatus`'s OVERDUE-conversion branch only triggers when the
*caller* explicitly requests `SENT` — since we always request `PAID` explicitly, the explicit
write always wins regardless of the auto-sync's timing.

**Result: NOT a bug, 3/3. PAID always wins by design; no inconsistency found.**

---

## Cleanup performed after testing

All test-created rows were deleted and modified rows restored to seed values:
- `homework_submissions` (homeworkId=9, studentId=2) — deleted
- `invoices` — test month 2026-08 and test invoice 118 — deleted
- `discussion_likes` (thread 1, Carol) — deleted
- `reschedule_requests` (session 2, Alice) — deleted
- Test user `user_id=7` (approve/reject race) — deleted
- 10 throwaway `race.rater.*` users and their ratings/rating_likes — deleted
- `tutor_payouts` for 2026-07 — deleted
- `race.invite.test1@gmail.com` user — deleted
- Test class `class_id=17` (capacity test) — deleted
- Test classes from assignClass race (ids 12, 13, 16 across trials) — deleted, tutor
  availability restored to seed state (`Monday 14:00-18:00`)
- `session_feedbacks` (session 6) — deleted, session status restored to SCHEDULED
- `ratings.likes` counter (rating_id=1) — restored to seed value (2)

Final verification: `users` count=5, `classes` count=10, `enrollments` count=16,
`homework_submissions` count=15 — all match original seed state.
