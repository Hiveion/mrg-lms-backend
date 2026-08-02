# Money fields: amount + currency, no more USD normalization

Branch: `remove-class-cap-default-fee-from-tutor-rate`

## What changed

1. **Class capacity cap removed entirely.** `Class.maxStudentCount` is gone from the schema.
   `CreateClassDto`, `UpdateClassDto`, and `AssignClassDto` no longer accept it, and
   `EnrollmentService.create` no longer enforces or checks any capacity limit — enrollment
   requests can no longer fail with "Class is already at maximum capacity". Classes are
   uncapped; `Class.currentStudentCount` is still tracked (incremented/decremented on
   enroll/unenroll) purely as a headcount for display.

2. **Every money field now stores its own `amount` + `currency` pair, instead of being
   implicitly normalized to a hardcoded base currency.** Previously `Class.classFee` and
   `Enrollment.assignedPrice` were plain numbers assumed to be USD, converted to a student's
   display currency at read time via `ClassFeeConverter` + `ExchangeRateService`
   (live exchange-rate API calls). That whole conversion layer is gone. `Tutor.hourlyRate` +
   `Tutor.currency` already followed the amount+currency pattern — that's the model now
   applied everywhere:

   | Record | Amount field(s) | Currency field | Set at |
   |---|---|---|---|
   | `Tutor` | `hourlyRate` | `currency` | tutor approval / admin rate update (unchanged) |
   | `Class` | `studentRateAmount` (replaces `classFee`) | `studentRateCurrency` | class creation, always explicit, never derived |
   | `Class` | `tutorHourlyRate` (unchanged, optional payout override) | *(implicitly `Tutor.currency`)* | class creation/update (unchanged) |
   | `Enrollment` | `assignedPrice` (unchanged) | `priceCurrency` (new) | enrollment creation, defaults to the student's own currency |
   | `Invoice` | `subtotal`/`discount`/`additionalPayment`/`total` (unchanged) | `currency` (new) | invoice generation/creation, from the student's currency |
   | `TutorPayout` | `amount` (unchanged) | `currency` (new) | payout generation, from the tutor's currency |

3. **Tutor fee vs. student rate are now explicitly two different, unrelated numbers.**
   What a tutor is paid (`Class.tutorHourlyRate` falling back to `Tutor.hourlyRate`, in
   `Tutor.currency`) and what a student is charged (`Class.studentRateAmount` /
   `studentRateCurrency`) don't derive from each other and are typically in different
   currencies. Creating a class **never** auto-fills the student rate from the tutor's rate —
   if you don't pass `studentRateAmount`/`studentRateCurrency`, the class simply has no
   student rate set (`null`) until someone sets one.

4. **All live currency conversion for display has been removed.** `ClassFeeConverter`
   (`src/Utils/class-fee-converter.ts`) and `ExchangeRateService`
   (`src/Services/exchange-rate.service.ts`, the exchangerate-api.com integration) are
   deleted — they had no remaining callers. Endpoints that used to convert amounts into a
   viewer's currency now just return the amount with its own real, stored currency.

## Schema changes (`prisma/schema.prisma`, migration `money_amount_currency_pairs`)

- `Class`: `classFee` → removed. Added `studentRateAmount Float?`, `studentRateCurrency String?`.
- `Enrollment`: added `priceCurrency String` (required).
- `Invoice`: added `currency String` (required).
- `TutorPayout`: added `currency String` (required).

Existing rows were backfilled with a temporary column default (`MVR` for
`Enrollment.priceCurrency` / `Invoice.currency`, `LKR` for `TutorPayout.currency`, matching
each model's implicit default currency elsewhere in the schema) and the default was then
dropped — new rows must set these explicitly, there's no silent fallback at the DB level.

## API usage

### `POST /classes` / `PATCH /classes/:id` — `CreateClassDto` / `UpdateClassDto`

No auth guard (pre-existing, unchanged).

| Field | Type | Required | Notes |
|---|---|---|---|
| `studentRateAmount` | number ≥ 0 | no | What a student is charged. |
| `studentRateCurrency` | string | **required if `studentRateAmount` is set** | Rejected by validation if `studentRateAmount` is given without it. |
| `tutorHourlyRate` | number ≥ 0 | no | Per-class payout-rate override, in `Tutor.currency`. Unrelated to the student rate. |

`maxStudentCount` is no longer accepted or returned.

```json
// POST /classes
{
  "name": "Advanced Calculus BC",
  "subjectId": 1,
  "tutorId": 1,
  "studentRateAmount": 150,
  "studentRateCurrency": "MVR"
}
```

### `POST /admin/assign-class` — `AssignClassDto`

Guarded: `AuthGuard('jwt')`, `RolesGuard`, `@Roles(ADMIN, COORDINATOR, TUTOR)`. Creates the
class, enrolls every student in `studentIds`, and (optionally) generates sessions, in one
transaction.

| Field | Type | Required | Notes |
|---|---|---|---|
| `studentRateAmount` | number | no | Sets `Class.studentRateAmount`. Also the fallback amount for each enrollment's `assignedPrice` if `studentPriceAmount` isn't given. |
| `studentRateCurrency` | string | **required if `studentRateAmount` is set** | Sets `Class.studentRateCurrency`. |
| `studentPriceAmount` | number | no | Explicit override applied to **every** enrolled student's `assignedPrice` in this batch (one flat value across the batch, not per-student). |
| `studentPriceCurrency` | string | **required if `studentPriceAmount` is set** | Applied to every enrollment's `priceCurrency` in this batch when set. |

`maxStudents` is no longer accepted.

**Per-student price/currency resolution** (per student in the batch):
```
assignedPrice  = studentPriceAmount   ?? studentRateAmount ?? 0
priceCurrency  = studentPriceCurrency ?? <that student's own Student.currency>
```
So without `studentPriceAmount`/`Currency`, every student gets the same numeric amount
(the class's `studentRateAmount`) but each is labeled with **their own** currency — there is
no conversion, so if two students in one batch have different `Student.currency` values,
they end up with the same number under different currency labels. Set
`studentPriceAmount`/`studentPriceCurrency` explicitly to give the whole batch one
coherent price.

```json
// POST /admin/assign-class
{
  "studentIds": [12, 13],
  "tutorId": 1,
  "subjectId": 4,
  "schedule": [{ "day": "MONDAY", "startTime": "16:00", "duration": 60 }],
  "studentRateAmount": 150,
  "studentRateCurrency": "MVR",
  "studentPriceAmount": 140,
  "studentPriceCurrency": "MVR"
}
```

### `POST /enrollments` — `CreateEnrollmentDto`

No auth guard (pre-existing, unchanged).

| Field | Type | Required | Notes |
|---|---|---|---|
| `assignedPrice` | number ≥ 0 | no | Defaults to `Class.studentRateAmount ?? 0` if omitted. |
| `priceCurrency` | string | no | Defaults to the enrolling `Student.currency` if omitted. |

### `PATCH /enrollments/:id/price` — `UpdateAssignedPriceDto`

| Field | Type | Required | Notes |
|---|---|---|---|
| `assignedPrice` | number ≥ 0 | yes | |
| `priceCurrency` | string | no | Only updated if provided; omitting it leaves the existing `priceCurrency` untouched. |

### `GET /classes`, `GET /classes/:id`, `GET /classes/my-classes`, `GET /enrollments/my-enrollments`

Previously these branched on the caller being a `STUDENT` to convert `classFee`/`assignedPrice`
into that student's currency. That branch is now a no-op passthrough — the response is
identical for every role, and amounts are returned with whatever `studentRateCurrency` /
`priceCurrency` is actually stored on the record.

### `POST /invoices/generate`, `POST /invoices` — invoice `currency`

Both invoice-creation paths now set `Invoice.currency` from the target student's
`Student.currency` at creation time — not caller-supplied. `generateInvoices` sums a
student's active `Enrollment.assignedPrice` values into `subtotal`/`total`; this assumes all
of that student's active enrollments share the same `priceCurrency` (true by default, since
`priceCurrency` defaults to the student's own currency — but not enforced if someone manually
overrides an individual enrollment's `priceCurrency` to something else).

`GET /invoices/parent`, `GET /invoices/student`, `GET /invoices/:id` no longer convert
amounts on the way out — they return the invoice's stored `currency` as-is, no live
exchange-rate lookups.

### `POST /payouts/generate`

`TutorPayout.currency` is now set from the tutor's `Tutor.currency` at generation time.
`amount` is still computed the same way it always was (`hoursCount * effectiveRate`, where
`effectiveRate = Class.tutorHourlyRate ?? Tutor.hourlyRate ?? 0`) — no conversion involved,
`currency` is purely a label for what that computed number is denominated in.

## Removed

- `src/Utils/class-fee-converter.ts` (`ClassFeeConverter`) — dead, no remaining callers.
- `src/Services/exchange-rate.service.ts` (`ExchangeRateService`) and
  `src/Modules/exchange-rate.module.ts` — dead, no remaining callers. The
  `EXCHANGE_RATE_API_KEY` env var is no longer read anywhere.
- `Class.maxStudentCount` and the capacity-check branch in `EnrollmentService.create`.
- `Class.classFee`, `AssignClassDto.baseFee`, `AssignClassDto.studentPrice` (renamed/replaced
  as described above).

## Known limitation

Invoice generation and per-batch `assignClass` pricing both trust that amounts entered under
different currencies are genuinely comparable in context (e.g. all of one student's
enrollments really are in one currency). Nothing in the code enforces this or converts
between currencies anymore — a manually mismatched currency will silently produce a
mathematically wrong sum. This is intentional (amounts are stored as their real, entered
values with no guessed conversion), but worth knowing before entering cross-currency data by
hand.
