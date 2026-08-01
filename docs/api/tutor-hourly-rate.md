# Tutor Compensation: Hourly Rate & Currency

Tutors have a default hourly pay rate (`Tutor.hourlyRate`) and a currency
(`Tutor.currency`) that only an admin (or, at approval time, a coordinator) can set. Together
they represent the tutor's base compensation, used to calculate monthly payouts
(`TutorPayout`) whenever an individual class doesn't specify its own rate. Both fields can be
set two ways: via a dedicated endpoint at any time, or optionally in the same request that
approves the tutor's application.

## Data model

```prisma
model Tutor {
  ...
  hourlyRate Float?  @map("hourly_rate")
  currency   String  @default("LKR") @map("currency")
  ...
}
```

- `hourlyRate` is nullable — a tutor with no rate set contributes `0` to payout calculations
  for any class that also has no rate of its own (see [Payout interaction](#payout-interaction)).
- `currency` defaults to `"LKR"` (Sri Lankan Rupees) at the database level, so every tutor has
  a currency even if it was never explicitly set (e.g. seeded/legacy rows are backfilled to
  `LKR` by the migration that added the column).
- `currency` is restricted to a fixed whitelist: **`LKR`, `USD`, `MVR`** — the only codes
  referenced anywhere else in this codebase (`Student.currency` defaults to `MVR`; `USD` is
  the fallback base currency used by `ClassFeeConverter`/`ExchangeRateService`). This is the
  first enforced currency whitelist in the app; `Student.currency` remains a free-form string
  elsewhere.
- `currency` is informational/display for now — it is **not** used by `PayoutService` or
  `ExchangeRateService` to convert `hourlyRate` or payout amounts. It records what currency a
  tutor's rate is quoted in; it doesn't trigger any conversion (see
  [Payout interaction](#payout-interaction)).

## Endpoint

### `PATCH /admin/tutors/:id/rate`

Sets (or updates) a tutor's default hourly rate and/or currency.

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | `ADMIN` only |
| **Path param** | `id` — the tutor's **User id** (not `Tutor.id`), consistent with `PATCH /admin/users/:id` |

Note: the class-level guard on `AdminController` allows `ADMIN` and `COORDINATOR` for most
routes, but this endpoint overrides that with a method-level `@Roles(UserRole.ADMIN)`, so
coordinators and tutors are rejected with `403`.

#### Request body

```json
{
  "hourlyRate": 45.5,
  "currency": "USD"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `hourlyRate` | number | no | `@IsNumber()`, `@Min(0)`, `@IsOptional()` — must be zero or positive if provided |
| `currency` | string | no | `@IsIn(['LKR', 'USD', 'MVR'])`, `@IsOptional()` |

Both fields are optional, but **at least one must be provided** — sending `{}` returns a
`400`. Send only the field(s) you want to change; the other is left untouched.

#### Response `200 OK`

Returns the updated `Tutor` record:

```json
{
  "id": 3,
  "bio": "Ph.D. in Theoretical Physics with 15 years of teaching experience.",
  "qualifications": ["Ph.D. Physics", "M.Ed. Secondary Education"],
  "applicationStatus": "ACCEPTED",
  "averageRating": 4.83,
  "totalReviews": 3,
  "hourlyRate": 45.5,
  "currency": "USD",
  "userId": 12
}
```

#### Error responses

| Status | Cause |
|---|---|
| `400 Bad Request` | neither `hourlyRate` nor `currency` provided, `hourlyRate` non-numeric/negative, or `currency` not in the whitelist |
| `401 Unauthorized` | missing/invalid JWT |
| `403 Forbidden` | caller is not `ADMIN` (e.g. `COORDINATOR` or `TUTOR`, including the tutor themselves) |
| `404 Not Found` | no `Tutor` profile exists for the given user id |

#### Example

```bash
curl -X PATCH https://api.example.com/admin/tutors/12/rate \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"hourlyRate": 45.5, "currency": "USD"}'
```

## Setting rate and currency at approval time

As an alternative to a separate `PATCH` call, an admin (or coordinator) can set a tutor's
default hourly rate and/or currency in the same request that approves their application.

### `POST /admin/approve-user/:id`

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | `ADMIN`, `COORDINATOR` |
| **Path param** | `id` — the user's id (works for any pending user, not just tutors) |

#### Request body

```json
{
  "hourlyRate": 25,
  "currency": "USD"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `hourlyRate` | number | no | `@IsNumber()`, `@Min(0)`, `@IsOptional()` — must be zero or positive if provided |
| `currency` | string | no | `@IsIn(['LKR', 'USD', 'MVR'])`, `@IsOptional()` |

- **Both optional, independently** — omit either or both (or send `{}`) and approval
  behaves exactly as before for that field.
- **Currency always defaults to `LKR` for tutors** — unlike `hourlyRate` (which is left
  untouched if omitted), approving a `TUTOR` always sets `currency`: to whatever value was
  sent, or to `'LKR'` if none was sent. This is what makes Sri Lankan Rupees the effective
  default for every newly approved tutor, on top of the schema-level default already applied
  when their `Tutor` row was created at registration.
- **Only applied to tutors** — if `hourlyRate`/`currency` are sent while approving a student,
  parent, or coordinator, they're silently ignored; approval proceeds normally and no `Tutor`
  row is touched or created.
- **Best-effort, non-fatal** — both fields are set via the same `updateTutorRate` logic used
  by `PATCH /admin/tutors/:id/rate`. If that write fails for some edge-case reason (e.g. no
  `Tutor` profile row exists yet), the error is logged but does **not** fail the approval —
  the user's status has already been flipped to `ACTIVE` by that point, so these secondary,
  best-effort fields shouldn't roll that back or return a confusing partial-failure response.
- Does not change the approval email — tutors are not told their rate or currency via email
  either way.

#### Response `200 OK`

Same shape as approval without a rate/currency — the `User` record, not the `Tutor` record:

```json
{
  "message": "User robert.smith@mrg-lms.com has been approved",
  "user": { "id": 12, "status": "ACTIVE", "userType": "TUTOR", "...": "..." }
}
```

Use `GET /admin/tutors` afterward to confirm the rate/currency were applied.

#### Error responses

| Status | Cause |
|---|---|
| `400 Bad Request` | `hourlyRate` non-numeric/negative, or `currency` not in the whitelist |
| `401 Unauthorized` | missing/invalid JWT |
| `403 Forbidden` | caller is neither `ADMIN` nor `COORDINATOR` |
| `404 Not Found` | no `User` exists for the given id |
| `409 Conflict` | user is not currently in `PENDING` status |

Note: unlike `PATCH /admin/tutors/:id/rate` (`ADMIN`-only), this route still allows
`COORDINATOR` per its existing role configuration — so a coordinator approving a tutor can
also set their initial rate/currency, even though only an `ADMIN` can change either
afterward via the dedicated rate endpoint.

#### Example

```bash
curl -X POST https://api.example.com/admin/approve-user/12 \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"hourlyRate": 25, "currency": "USD"}'
```

## Reading the rate and currency

`GET /admin/tutors` (admin/coordinator) and `GET /users/tutors` already include the full
`Tutor` record, so `hourlyRate` and `currency` are present on every tutor object with no
extra query params.

## Payout interaction

Monthly payouts (`PayoutService.previewPayouts` / `generatePayouts`) compute each class's
effective hourly rate as:

```
effectiveRate = Class.tutorHourlyRate ?? Tutor.hourlyRate ?? 0
```

- If a class has its own `tutorHourlyRate` set, that value wins (per-class override).
- Otherwise the tutor's default `hourlyRate` is used.
- If neither is set, the rate is `0` (unchanged prior behavior).

This means setting a tutor's default rate retroactively affects **future** payout runs for
any of their classes that don't already have an explicit per-class rate — it does not alter
already-generated `TutorPayout`/`TutorPayoutItem` records, since those store computed
`amount`/`hoursCount` snapshots rather than re-deriving from the current rate.

`Tutor.currency` is **not** read anywhere in `PayoutService` — payout `amount`s are computed
and stored as plain numbers with no currency conversion applied. Setting a tutor's currency
does not change how their payouts are calculated; it only records what currency their
`hourlyRate` is quoted in for display purposes.

## What these endpoints do *not* do

- Neither touches `Class.tutorHourlyRate` — per-class overrides must still be set via the
  class endpoints (`POST /classes`, `PATCH /classes/:id`).
- Neither field is reachable from the tutor's own self-service profile endpoint
  (`PUT /auth/profile`) — that endpoint only accepts `bio`/`qualifications` for a tutor's
  profile, so a tutor cannot set their own rate or currency by any path, approval included.
- Setting `currency` does not trigger any currency conversion of `hourlyRate`, payouts, or
  anything else — see [Payout interaction](#payout-interaction).
