# Class requests: tutor-submitted, admin-approved class creation

A `TUTOR` can no longer set a student fee or tutor fee, or create a live class directly.
Instead they submit a **class request** (`ClassRequest`) describing the class they want —
subject, students, weekly schedule — with no pricing fields at all. Nothing is enrolled or
scheduled yet. An `ADMIN`/`COORDINATOR` reviews the request and either **approves** it
(supplying `studentRateAmount`/`studentRateCurrency` and `tutorHourlyRate`/
`tutorRateCurrency` — every fee amount is paired with its own currency, never assumed —
which materializes the real `Class` + `ClassSchedule` + `Enrollment`s + `Session`s +
calendar invites) or **rejects** it. `POST /admin/assign-class`, the endpoint that used
to let a tutor create-and-price a class in one step, is now `ADMIN`/`COORDINATOR` only.

Implementation: `src/Controllers/admin.controller.ts`, `src/Services/admin.service.ts`
(`createClassRequest`, `listClassRequests`, `listMyClassRequests`,
`approveClassRequest`, `rejectClassRequest`, and the shared private `materializeClass`
helper extracted from `assignClass`), `src/DTOs/class-request.dto.ts`.

## Data model

```prisma
enum ClassRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model ClassRequest {
  id               Int      @id @default(autoincrement()) @map("class_request_id")
  tutorId          Int      @map("tutor_id")
  subjectId        Int      @map("subject_id")
  name             String?  @map("class_name")
  grade            String?
  studentIds       Int[]    @map("student_ids")
  schedule         Json     @map("schedule")            // ClassScheduleDto[] snapshot
  startDate        String?  @map("start_date")
  frequency        Int?
  numberOfWeeks    Int?     @map("number_of_weeks")
  createSessions   Boolean  @default(true) @map("create_sessions")
  status           ClassRequestStatus @default(PENDING)
  rejectionReason  String?  @map("rejection_reason")
  resultingClassId Int?     @unique @map("resulting_class_id")
  reviewedById     Int?     @map("reviewed_by_id")
  reviewedAt       DateTime? @map("reviewed_at")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
}
```

No fee/price column exists on this model — a request is priced only once, at approval
time, directly on the resulting `Class` (`studentRateAmount`/`studentRateCurrency`,
`tutorHourlyRate`/`tutorRateCurrency` — `Class` pairs every fee amount with its own
currency column; the tutor rate is never assumed to be in the tutor's default
`Tutor.currency`, it's an explicit choice made at approval time).

## Auth summary

Controller-level guard on `AdminController` is `AuthGuard('jwt')` + `RolesGuard` +
`@Roles(ADMIN, COORDINATOR)`; per-route overrides below.

| Route | Method | Roles |
|---|---|---|
| `/admin/request-class` | `POST` | `TUTOR` |
| `/admin/class-requests` | `GET` | `ADMIN`, `COORDINATOR` |
| `/admin/class-requests/my` | `GET` | `TUTOR` |
| `/admin/class-requests/:id/approve` | `PATCH` | `ADMIN`, `COORDINATOR` |
| `/admin/class-requests/:id/reject` | `PATCH` | `ADMIN`, `COORDINATOR` |
| `/admin/assign-class` | `POST` | `ADMIN`, `COORDINATOR` (was also `TUTOR` before this change) |

Missing/invalid JWT → `401`. Valid JWT, wrong role → `403`.

## Endpoints

### `POST /admin/request-class` — tutor submits a request

Body (`RequestClassDto`) — **no fee fields accepted**; `tutorId` is never read from the
body, it's derived from the caller's JWT.

```json
{
  "subjectId": 1,
  "studentIds": [7, 8],
  "grade": "Grade 10",
  "name": "Physics - Evening Batch",
  "schedule": [{ "day": "MONDAY", "startTime": "17:00", "duration": 60 }],
  "startDate": "2026-08-10",
  "numberOfWeeks": 4,
  "createSessions": true
}
```

| Field | Type | Required |
|---|---|---|
| `subjectId` | int | yes |
| `studentId` / `studentIds` | int / int[] | at least one, either form |
| `grade`, `name`, `startDate` | string | no |
| `schedule` | `{day, startTime, duration}[]` | yes |
| `frequency`, `numberOfWeeks` | int | no |
| `createSessions` | boolean | no (defaults `true` at approval) |

Response `201`: the created `ClassRequest` (with `subject`), `status: "PENDING"`.

Errors: `404` — tutor profile / subject / one of the students not found.

### `GET /admin/class-requests` — admin review queue

Optional `?status=PENDING|APPROVED|REJECTED` filter. Returns requests with `tutor.user`,
`subject`, and a resolved `students` array, newest first — everything an admin needs to
prefill the approve form:

- `tutor.hourlyRate` / `tutor.currency` — the tutor's **default** rate/currency, shown
  as a starting point for the `tutorHourlyRate`/`tutorRateCurrency` the admin is about
  to set on this specific class (the two can differ; nothing forces them to match).
- `students[]` — each requested student's `currency` (plus `id`, `grade`,
  `user.firstName`/`user.lastName`), resolved from `ClassRequest.studentIds` (a plain
  `Int[]`, not a relation, so it isn't otherwise visible in the response) — lets the
  admin see what currency each student is billed in before setting
  `studentRateCurrency`.

```json
{
  "id": 5,
  "status": "PENDING",
  "studentIds": [7, 8],
  "subject": { "id": 1, "name": "Physics" },
  "tutor": {
    "id": 9,
    "hourlyRate": 25.0,
    "currency": "LKR",
    "user": { "firstName": "Jane", "lastName": "Doe" }
  },
  "students": [
    { "id": 7, "grade": "Grade 10", "currency": "MVR", "user": { "firstName": "Sam", "lastName": "Lee" } },
    { "id": 8, "grade": "Grade 10", "currency": "USD", "user": { "firstName": "Ana", "lastName": "Perera" } }
  ]
}
```

### `GET /admin/class-requests/my` — tutor's own requests

Returns the caller's `ClassRequest`s (with `subject`), newest first.

### `PATCH /admin/class-requests/:id/approve` — set fees and go live

Body (`ApproveClassRequestDto`):

| Field | Type | Required |
|---|---|---|
| `studentRateAmount` | number ≥ 0 | **yes** |
| `studentRateCurrency` | string | **yes** |
| `tutorHourlyRate` | number ≥ 0 | **yes** |
| `tutorRateCurrency` | string | **yes** |
| `studentPriceAmount` / `studentPriceCurrency` | number / string | no — per-student override, same semantics as `assignClass` |

`tutorRateCurrency` does not have to match the tutor's default `Tutor.currency` (visible
on the same request via `tutor.currency`, see above) — it's whatever currency this
specific class's rate is being set in.

On success this runs the same transactional creation `assignClass` always has —
`Class` (now with `tutorHourlyRate`/`tutorRateCurrency` populated too) + `ClassSchedule`s +
`Enrollment`s (`ACTIVE`, priced) + `Session`s + Google Calendar invites — using the
request's stored subject/students/schedule, sets `ClassRequest.status = APPROVED` and
`resultingClassId`, and sends the tutor an in-app `CLASS` notification. Response `200`:
the created `Class` (with `subject`, `tutor.user`, `sessions`, `schedules`,
`enrollments.student.user`).

Errors: `404` request not found · `409` request is no longer `PENDING` (already
approved/rejected, or a concurrent approve won the race) · `409` on a scheduling
conflict during materialization (a competing request punched out the same
availability slot first) — the request is reverted to `PENDING` so it can be retried.

### `PATCH /admin/class-requests/:id/reject`

Body (`RejectClassRequestDto`): `{ "reason"?: string }`. Atomically flips
`PENDING → REJECTED`, records `rejectionReason`/`reviewedById`/`reviewedAt`, notifies
the tutor. Response `200`: the updated `ClassRequest`.

Errors: `404` not found · `409` not `PENDING`.

## Functionality summary

1. Tutor submits a request → `PENDING`, no DB side effects beyond the `ClassRequest` row.
2. Admin/coordinator reviews the queue (`GET /admin/class-requests`).
3. **Approve** → both fees required → class, schedule, enrollments, sessions, and
   calendar invites are created in one step, exactly as the old direct `assignClass`
   flow did; tutor is notified. **Reject** → tutor is notified with the reason, no
   class is ever created.
4. Approve/reject are each guarded by an atomic conditional update, so two admins
   racing on the same request can't both succeed.
5. `POST /admin/assign-class` still exists for admins/coordinators who want to create
   and price a class directly in one step (e.g. staff-initiated classes) — it now also
   accepts `tutorHourlyRate`/`tutorRateCurrency` (both optional there, required only on
   the approve-request path), which it previously silently dropped.
6. Adjacent fix: `POST/PATCH/DELETE /classes` (`ClassController`, a separate/legacy
   bare-CRUD path that doesn't create schedules or enrollments) had no auth guards at
   all before this change — anyone could set `studentRateAmount`/`tutorHourlyRate`
   through it. Now requires `ADMIN`/`COORDINATOR`.
