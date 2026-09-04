# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

A Cinema Reservation System backend per `prd.md`: authenticated users view a 115-seat
layout, hold seats for 15 minutes, then complete the booking. Hard requirements: no
double-booking under concurrency, two seating rules (Rule 1: consecutive same-row seats;
Rule 2: no isolated empty seat), local Docker execution. Full spec: `prd.md`. Full
API/setup docs: `README.md`. ERD: `docs/ERD.md`.

## Stack & structure

npm workspaces — `packages/server` is the only package today (`packages/web`, a React
frontend, will land later). Node.js/TypeScript, Express, PostgreSQL via Drizzle ORM, zod
for request validation, Docker Compose for local infra.

```
packages/server/src/
├─ index.ts       # bootstrap: parses --mode= (server/sweep/server-with-sweep), starts what's needed
├─ app.ts         # express app factory, no .listen() — supertest-ready
├─ config/env.ts  # typed env
├─ db/            # schema.ts, client.ts, migrations/, migrate.ts, seed.ts, clean.ts
├─ middleware/    # authGuard, errorHandler, asyncHandler, requestLogger
├─ routes/        # auth, seats, reservations — zod safeParse for shape validation
├─ services/      # authService, seatService, reservationService (business logic + DB)
├─ domain/        # layout.ts (seat-id parsing), seating.ts (Rule 1/2, pure fns + warn log)
└─ types/AppError.ts
```

## Commands (run from repo root; delegate to the server workspace)

- `npm run dev` — tsx watch
- `npm test` — node:test; currently only `domain/seating.ts` is unit-tested
- `npm run build` / `npm start`
- `npm run db:generate` — drizzle-kit generate (after editing `db/schema.ts`)
- `npm run db:migrate`, `npm run seed`, `npm run db:clean` — clean truncates all tables
  (schema/migrations untouched)
- `docker compose up --build` — full stack (Postgres + server); container runs
  migrate → seed → start on boot

## Conventions to follow

- **No dedicated logger.** Plain `console.log` / `console.warn` / `console.error`,
  matching existing calls. Don't introduce a logging library for a handful of call
  sites.
- **`AppError`** (`types/AppError.ts`) is the only error type routes/services should
  throw for expected failures (400/401/403/404/409/410/422). `errorHandler.ts` logs
  nothing for `AppError` instances — only unexpected non-AppError errors get
  `console.error`'d before a 500. That's why `reservationService.ts` has a `reject()`
  helper: it `console.warn`s with context, then throws, so validation/business-rule
  rejections stay visible server-side.
- **zod validation is inline per-route** (`schema.safeParse(...)` → `AppError.badRequest`
  on failure), not generic middleware — see `routes/auth.ts` / `routes/reservations.ts`.
  Keep zod schemas shape-only; deeper business/domain rules (seat-id format, Rule 1/2)
  belong in `domain/` and `services/`, not duplicated into the zod schema.
- **`domain/seating.ts` has no DB/network I/O** and is unit-tested directly. Its only
  side effect is a `console.warn` on rule failure (via the shared `fail()` helper) —
  don't add DB/IO calls here.
- Concurrency correctness relies on a `SELECT ... FOR UPDATE` row lock (scoped to one
  cinema row per request — Rule 1 guarantees a reservation never spans rows) plus a
  partial unique index (`uniq_active_seat ON reservation_seats(seat_id) WHERE active`)
  as the DB-level backstop. Any change to `createReservation`'s locking order or to
  that index must preserve "exactly one success, rest 409" under concurrent requests
  for the same seat.
- Expiry is three-tiered, and each tier's scope must stay bounded: reads never write;
  `createReservation`/`completeReservation` release stale holds only within the
  row/reservation they already hold a lock on (via `expireReservations`); the
  background sweeper (`sweepExpiredReservations`, driven by `--mode=sweep`/`server-with-sweep`) is
  the only place a global scan happens, and it re-checks the status/expiry predicate
  atomically in its own `UPDATE` (no prior lock to rely on). Don't add ad-hoc global
  expiry sweeps elsewhere, and don't route sweeper-style bulk expiry through
  `expireReservations` — that helper assumes the caller already holds a lock.
- Run mode (`server` / `sweep` / `server-with-sweep`) is resolved once in `index.ts` from
  `--mode=` → `RUN_MODE` env → default `server-with-sweep`. Keep that resolution logic there, not
  duplicated in the Dockerfile/entrypoint (which just forwards args through).

## Testing

Only `domain/seating.ts` has unit tests today (`node --test`, no DB involved).
Integration tests (supertest against a real/mocked Postgres) are a known gap — see
README's Testing section.

## Git

Only commit when explicitly asked.
