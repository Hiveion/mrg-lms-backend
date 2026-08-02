# Subjects

`Subject` is a flat lookup/reference entity (e.g. "Mathematics", "English") that every
`Class` must belong to (`Class.subjectId` is a required foreign key). Subjects are managed
through a standard CRUD resource at `/subjects`; reads are open to any authenticated user
(subjects are needed across roles to populate class-creation dropdowns), while creating,
updating, and deleting a subject is restricted to `ADMIN`/`COORDINATOR`.

## Data model

```prisma
model Subject {
  id          Int      @id @default(autoincrement()) @map("subject_id")
  name        String   @unique
  description String?
  code        String?  @unique // e.g., "MATH101", "ENG201"
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  classes Class[]

  @@map("subjects")
}
```

- `name` is **required and unique** — attempting to create/update to a name already in use
  returns `409 Conflict`.
- `code` is **optional but unique** when provided (e.g. `"MATH101"`); multiple subjects with
  no code (`null`) are allowed since Postgres treats `NULL` as distinct in a unique index.
- `description` is a free-form optional string.
- `classes` is the reverse relation to every `Class` currently using this subject; it's
  included in `findAll`/`findOne` responses (see below) so callers can see usage without an
  extra request.

## Auth summary

All routes require a valid JWT (`AuthGuard('jwt')`). Mutating routes additionally require
the `RolesGuard` role check.

| Route | Roles allowed |
|---|---|
| `POST /subjects` | `ADMIN`, `COORDINATOR` |
| `GET /subjects` | any authenticated user |
| `GET /subjects/:id` | any authenticated user |
| `PATCH /subjects/:id` | `ADMIN`, `COORDINATOR` |
| `DELETE /subjects/:id` | `ADMIN`, `COORDINATOR` |

Missing/invalid JWT → `401 Unauthorized`. Valid JWT but wrong role on a mutating route →
`403 Forbidden`.

## Endpoints

### `POST /subjects`

Creates a new subject.

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | `ADMIN`, `COORDINATOR` |

#### Request body

```json
{
  "name": "Mathematics",
  "description": "Core mathematics curriculum",
  "code": "MATH101"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | yes | `@IsString()`, `@IsNotEmpty()` |
| `description` | string | no | `@IsString()`, `@IsOptional()` |
| `code` | string | no | `@IsString()`, `@IsOptional()` |

#### Response `201 Created`

```json
{
  "id": 1,
  "name": "Mathematics",
  "description": "Core mathematics curriculum",
  "code": "MATH101",
  "createdAt": "2026-08-02T10:15:00.000Z",
  "updatedAt": "2026-08-02T10:15:00.000Z"
}
```

#### Error responses

| Status | Cause |
|---|---|
| `400 Bad Request` | `name` missing/empty, or `name`/`description`/`code` not a string |
| `401 Unauthorized` | missing/invalid JWT |
| `403 Forbidden` | caller is not `ADMIN` or `COORDINATOR` |
| `409 Conflict` | `name` or `code` already exists on another subject |

#### Example

```bash
curl -X POST https://api.example.com/subjects \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mathematics", "code": "MATH101", "description": "Core mathematics curriculum"}'
```

### `GET /subjects`

Lists all subjects, each including its related classes.

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | any authenticated user |

#### Response `200 OK`

```json
[
  {
    "id": 1,
    "name": "Mathematics",
    "description": "Core mathematics curriculum",
    "code": "MATH101",
    "createdAt": "2026-08-02T10:15:00.000Z",
    "updatedAt": "2026-08-02T10:15:00.000Z",
    "classes": []
  }
]
```

#### Error responses

| Status | Cause |
|---|---|
| `401 Unauthorized` | missing/invalid JWT |

#### Example

```bash
curl https://api.example.com/subjects \
  -H "Authorization: Bearer $JWT"
```

### `GET /subjects/:id`

Fetches a single subject by id, including its related classes.

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | any authenticated user |
| **Path param** | `id` — the subject's numeric id |

#### Response `200 OK`

```json
{
  "id": 1,
  "name": "Mathematics",
  "description": "Core mathematics curriculum",
  "code": "MATH101",
  "createdAt": "2026-08-02T10:15:00.000Z",
  "updatedAt": "2026-08-02T10:15:00.000Z",
  "classes": []
}
```

#### Error responses

| Status | Cause |
|---|---|
| `401 Unauthorized` | missing/invalid JWT |
| `404 Not Found` | no subject exists with the given id |

#### Example

```bash
curl https://api.example.com/subjects/1 \
  -H "Authorization: Bearer $JWT"
```

### `PATCH /subjects/:id`

Updates one or more fields of an existing subject.

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | `ADMIN`, `COORDINATOR` |
| **Path param** | `id` — the subject's numeric id |

#### Request body

All fields optional — send only what you want to change.

```json
{
  "description": "Updated description"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | no | `@IsString()`, `@IsOptional()` |
| `description` | string | no | `@IsString()`, `@IsOptional()` |
| `code` | string | no | `@IsString()`, `@IsOptional()` |

#### Response `200 OK`

Returns the updated `Subject` record (without the `classes` relation).

```json
{
  "id": 1,
  "name": "Mathematics",
  "description": "Updated description",
  "code": "MATH101",
  "createdAt": "2026-08-02T10:15:00.000Z",
  "updatedAt": "2026-08-02T11:00:00.000Z"
}
```

#### Error responses

| Status | Cause |
|---|---|
| `400 Bad Request` | a provided field is not a string |
| `401 Unauthorized` | missing/invalid JWT |
| `403 Forbidden` | caller is not `ADMIN` or `COORDINATOR` |
| `404 Not Found` | no subject exists with the given id |
| `409 Conflict` | updated `name` or `code` collides with another subject |

#### Example

```bash
curl -X PATCH https://api.example.com/subjects/1 \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'
```

### `DELETE /subjects/:id`

Deletes a subject.

| | |
|---|---|
| **Auth** | `AuthGuard('jwt')` — valid bearer token required |
| **Roles** | `ADMIN`, `COORDINATOR` |
| **Path param** | `id` — the subject's numeric id |

#### Response `200 OK`

Returns the deleted `Subject` record.

```json
{
  "id": 1,
  "name": "Mathematics",
  "description": "Updated description",
  "code": "MATH101",
  "createdAt": "2026-08-02T10:15:00.000Z",
  "updatedAt": "2026-08-02T11:00:00.000Z"
}
```

#### Error responses

| Status | Cause |
|---|---|
| `401 Unauthorized` | missing/invalid JWT |
| `403 Forbidden` | caller is not `ADMIN` or `COORDINATOR` |
| `404 Not Found` | no subject exists with the given id |

Note: `Class.subjectId` is a required foreign key with no `onDelete: Cascade` configured in
the schema, so deleting a subject that still has classes attached will fail at the database
level with a foreign-key constraint error (surfaces as an unhandled `500`, since
`SubjectService.remove` only translates Prisma's `P2025` — not-found — into a `404`; it does
not currently special-case `P2003` foreign-key violations). Remove or reassign a subject's
classes before deleting it.

#### Example

```bash
curl -X DELETE https://api.example.com/subjects/1 \
  -H "Authorization: Bearer $ADMIN_JWT"
```

## What this endpoint does *not* do

- No bulk-create or bulk-import endpoint — subjects are created one at a time.
- No pagination on `GET /subjects` — it returns every subject in one response.
- No soft delete — `DELETE /subjects/:id` is a hard delete, blocked only by the FK
  constraint described above.
