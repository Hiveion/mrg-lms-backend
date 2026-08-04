# Enrollments: tutor details in responses

`EnrollmentService` (`src/Services/enrollment.service.ts`) now includes the enrolled
class's tutor on `findAll`, `findOne`, and `update`, so `GET /enrollments`,
`GET /enrollments/:id`, and `PATCH /enrollments/:id` return `class.tutor` alongside the
existing `class.subject`. Previously these three methods only included `subject` under
`class` — no tutor data was returned at all, even though every `Class` has a required
`tutorId`.

## Affected endpoints

| Route | Controller method |
|---|---|
| `GET /enrollments` | `EnrollmentController.findAll` |
| `GET /enrollments/:id` | `EnrollmentController.findOne` |
| `PATCH /enrollments/:id` | `EnrollmentController.update` |

Not changed: `POST /enrollments`, `GET /enrollments/my-enrollments`,
`GET /enrollments/next-sessions`, `PATCH /enrollments/:id/price`,
`PATCH /enrollments/:id/recording-access`, `DELETE /enrollments/:id`. The two
`my-enrollments`/`next-sessions` routes already returned tutor data via a separate
code path (`findByStudentUserId`/`findNextSessions`), which is unchanged.

## Response shape

`class.tutor` is now present:

```json
{
  "id": 42,
  "studentId": 7,
  "classId": 3,
  "assignedPrice": 1500,
  "priceCurrency": "LKR",
  "status": "ACTIVE",
  "student": { "...": "..." },
  "class": {
    "id": 3,
    "tutorId": 9,
    "...": "...",
    "subject": { "id": 1, "name": "Mathematics" },
    "tutor": {
      "id": 9,
      "bio": "10 years teaching experience",
      "averageRating": 4.8,
      "totalReviews": 32,
      "hourlyRate": 25.0,
      "currency": "LKR",
      "user": {
        "id": 21,
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane.doe@example.com",
        "profilePicture": "https://.../avatar.jpg",
        "phoneNumber": "+94771234567"
      }
    }
  }
}
```

## Field selection

`tutor` is fetched with an explicit Prisma `select` (constant `TUTOR_SELECT` in
`enrollment.service.ts`), not a bare `include: { user: true }`. Included fields:

- `Tutor`: `id`, `bio`, `averageRating`, `totalReviews`, `hourlyRate`, `currency`
- `Tutor.user`: `id`, `firstName`, `lastName`, `email`, `profilePicture`, `phoneNumber`

This deliberately excludes sensitive `User` columns — `passwordHash`, `googleId`,
`googleAccessToken`/`googleRefreshToken`/`googleTokenExpiry`,
`resetPasswordToken`/`resetPasswordExpires` — that a bare `include: { user: true }`
would otherwise leak into the API response. `student.user` on these same endpoints still
uses `include: { user: true }` (pre-existing behavior, not changed here).

## Auth note

`GET /enrollments` and `GET /enrollments/:id` have no `@UseGuards(...)` applied
(pre-existing, unrelated to this change) — they are reachable without a JWT. Since they
now surface tutor `email`/`phoneNumber`, this is worth revisiting if the endpoint is
meant to be admin/coordinator-only.
