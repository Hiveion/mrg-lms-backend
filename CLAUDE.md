# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MRG LMS Backend is a NestJS REST API (TypeScript) for a tutoring/learning-management platform, using Prisma ORM against PostgreSQL. It handles user auth (local + Google OAuth), class/session scheduling with Google Calendar integration, enrollments, homework, invoicing/payouts, ratings, discussions, notifications, and file resources.

## Commands

```bash
# install
npm install

# run
npm run start          # normal start
npm run start:dev      # watch mode (most common for local dev)
npm run start:debug    # watch mode + --inspect

# build
npm run build           # nest build -> dist/
npm run start:prod      # run built output (node dist/main)

# lint / format
npm run lint             # eslint --fix on src/apps/libs/test
npm run format            # prettier --write on src/ and test/

# tests
npm run test              # jest unit tests (*.spec.ts, colocated in src/)
npm run test:watch
npm run test:cov
npm run test:debug
npm run test:e2e          # jest e2e (test/*.e2e-spec.ts), separate config at test/jest-e2e.json

# run a single test file
npx jest path/to/file.spec.ts
npx jest -t "test name pattern"

# Prisma
npx prisma migrate dev --name <description>   # create + apply a new migration locally
npx prisma migrate deploy                       # apply pending migrations (used in prod via start.sh)
npx prisma generate                             # regenerate the Prisma client after schema changes
npx prisma studio                               # browse the DB
npm run db:seed   # not defined as an npm script; run via: npx ts-node prisma/seed.ts
```

There is no top-level Prisma script in `package.json`; `prisma.seed` config in `package.json` points to `ts-node prisma/seed.ts`, invoked by `npx prisma db seed`.

## Environment

Copy `.env.example` to `.env`. Key variables: `DATABASE_URL` (Postgres), `PORT`, `BACKEND_URL`, `FRONTEND_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL` (OAuth + Calendar/Drive access), `MAIL_HOST`/`MAIL_PORT`/`MAIL_USER`/`MAIL_PASS`/`MAIL_FROM` (SMTP via nodemailer), `EXCHANGE_RATE_API_KEY`. `main.ts` calls `dotenv.config()` before anything else loads.

Deployment is to Railway via Docker (`Dockerfile` + `railway.toml`); `start.sh` runs `prisma migrate deploy` then starts the compiled server. See `DEPLOYMENT.md` for the full Railway setup/env-var list and troubleshooting table.

## Architecture

This is **not** the default Nest CLI layout (no per-feature `foo/foo.module.ts` folders). Instead, code is grouped by *layer* under `src/`, with one file per feature per layer:

- `Controllers/*.controller.ts` — HTTP route handlers only; delegate to services.
- `Services/*.service.ts` — business logic, Prisma queries.
- `Modules/*.module.ts` — wires one controller + one service (+ its dependent modules) together; each is imported into `app.module.ts`.
- `DTOs/*.dto.ts` — `class-validator`/`class-transformer` request/response shapes, matched 1:1 with feature (not per-controller-method).
- `Database/` — `PrismaService` (extends `PrismaClient`, connects `onModuleInit`) wrapped in a `@Global()` `DatabaseModule`, so `PrismaService` is injectable everywhere without re-importing `DatabaseModule` in most modules (it's still imported explicitly by convention in feature modules).
- `Guards/` — `RolesGuard` (reads `@Roles(...)` metadata and checks `user.userType`), `google-auth.guard.ts` for the OAuth flow.
- `Decorators/roles.decorator.ts` — `@Roles(...UserRole[])` sets the `'roles'` metadata key consumed by `RolesGuard`.
- `Strategies/` — Passport strategies: `jwt.strategy.ts` (validates bearer JWT, loads user via `UsersService`, rejects `INACTIVE` users) and `google.strategy.ts`.
- `Utils/` — cross-cutting helpers, e.g. `class-fee-converter.ts` for currency conversion of fees/prices.

When adding a new feature, the pattern is: add a Prisma model → add DTOs → add a service → add a controller → add a module that wires them → register the module in `app.module.ts`.

### Auth & authorization

- JWT auth: `AuthGuard('jwt')` from `@nestjs/passport` guards routes; `req.user` is the Prisma `User` (with profile relations) returned by `JwtStrategy.validate`.
- Role-based access: combine `@UseGuards(AuthGuard('jwt'), RolesGuard)` with `@Roles(UserRole.ADMIN, ...)`; `RolesGuard` allows the route through if no roles metadata is set.
- Google OAuth (`google.strategy.ts` + `google-auth.guard.ts`) is used both for "Sign in with Google" and to capture `googleAccessToken`/`googleRefreshToken` for later Calendar/Drive API calls (`GoogleService`).
- Guard usage across controllers is inconsistent — not every mutating endpoint has `@UseGuards(...)` applied (e.g. some `create`/`update`/`remove` methods in `class.controller.ts`). Check each controller method individually rather than assuming route-level protection; don't assume a sibling method's guard applies.
- `UserRole` enum (ADMIN, COORDINATOR, TUTOR, STUDENT, PARENT) and `UserStatus` (ACTIVE, INACTIVE, PENDING, INCOMPLETE) drive most authorization/business-flow branching. Registration flow: users start `INCOMPLETE` → pick a role (`completeRegistration`) → TUTOR/STUDENT go to `PENDING` (needs admin approval), others go straight to `ACTIVE`.

### Data model (Prisma, `prisma/schema.prisma`)

Central entity is `User` (1:1 optional profile relations to `Tutor`, `Student`, `Parent`, `Coordinator` based on `userType`). From there:

- **Academic structure**: `Subject` → `Class` (owned by a `Tutor`) → `ClassSchedule` (recurring weekly slot) and `Session` (a concrete scheduled occurrence, linked to Google Calendar via `googleEventId`, tracks recording/transcript fetch status).
- **Enrollment**: `Student` ↔ `Class` via `Enrollment` (status flow: REQUESTED → DEMO_SCHEDULED → DEMO_COMPLETED → ACTIVE/INACTIVE), carrying `assignedPrice` and `recordingAccess`.
- **Homework**: `Homework` → `HomeworkQuestion` → `HomeworkSubmission` → `SubmissionAnswer`.
- **Money**: `Invoice`/`InvoiceItem`/`Payment` (student-facing billing) and `TutorPayout`/`TutorPayoutItem` (tutor-facing payouts) are separate flows. Class fees are stored in a base currency and converted per-student via `ExchangeRateService` + `ClassFeeConverter` (see `Student.currency`).
- **Engagement**: `Rating`/`RatingLike` (student → tutor reviews), `DiscussionThread`/`DiscussionReply`/`DiscussionLike`/`ReplyLike` (per-class Q&A/announcements), `Notification`, `Resource` (uploaded class files), `SessionFeedback`.
- **Scheduling extras**: `TutorAvailability`/`StudentAvailability`, `RescheduleRequest`.

Prisma field names are `camelCase` in the client but `@map`/`@@map`'d to `snake_case` columns/tables in Postgres — when writing raw SQL or reading migration files, expect snake_case; the Prisma Client API uses camelCase.

### Background jobs

`@nestjs/schedule` cron jobs (e.g. `RecordingScheduler.checkForNewRecordings`, `EVERY_10_MINUTES`) poll for finished sessions and pull recordings/transcripts from Google via `GoogleService`.

### Currency conversion

`ExchangeRateService` (backed by `EXCHANGE_RATE_API_KEY`) provides live conversion; `ClassFeeConverter` (`Utils/`) is a static helper used by services to convert `Class.classFee`/`Enrollment.assignedPrice` into a student's preferred currency (`Student.currency`, default `MVR`) without mutating stored values — conversion happens at read time, original amounts are preserved alongside converted ones in the response shape (`*Original`, `*BaseCurrency`, `*StudentCurrency` fields).

## Conventions

- Prettier: single quotes, trailing commas everywhere (`.prettierrc`). ESLint extends `@typescript-eslint/recommended` + `plugin:prettier/recommended`; `no-explicit-any`, `explicit-function-return-type`, and `explicit-module-boundary-types` are all turned off, so `any` and implicit return types are used freely and idiomatically throughout the codebase (e.g. `@Req() req: any`).
- `tsconfig.json` has `noImplicitAny: false` and `strictNullChecks: true` — null/undefined handling is checked, but untyped `any` is not.
- Unit tests (`*.spec.ts`) live alongside the code they test inside `src/`; only e2e specs live under `test/`.
