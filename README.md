# Cinema Reservation System

A full-stack app for reserving cinema seats: authenticated users can view a 115-seat
layout, place a temporary hold on a set of seats, and complete the reservation to book
them permanently. Built to guarantee — even under concurrent requests — that no seat is
ever double-booked and that seat selections obey the venue's seating rules.

## Stack

- **Backend:** Node.js + TypeScript, Express
- **Frontend:** React + TypeScript (Vite), no Redux — local component state + hooks
- **Shared:** `@cinema/shared` — the seating domain rules and layout, plus the API's
  request (zod) schemas and response types, used by both backend and frontend so
  validation and wire types can never drift between them
- **Database:** PostgreSQL (via [Drizzle ORM](https://orm.drizzle.team/))
- **Infra:** Docker / Docker Compose
- **Structure:** npm workspaces — `packages/shared`, `packages/server`, `packages/web`

## Quickstart (Docker)

```bash
docker compose up --build
```

This starts Postgres, waits for it to be healthy, builds `@cinema/shared`, then builds
and runs the API (migrate → seed → start on boot) and the web frontend (a static build
served by nginx). Once it's up:

- **Frontend:** `http://localhost:8080`
- **API:** `http://localhost:3000`

Seeded demo users (see [`seed.ts`](packages/server/src/db/seed.ts)) — log in with any of
these on the frontend, or use them against the API directly:

| username | password       |
|----------|----------------|
| alice    | password123    |
| bob      | password123    |
| carol    | password123    |

## Running locally (without Docker)

Backend + database:

```bash
npm install
docker compose up -d db          # just the database
cp packages/server/.env.example packages/server/.env
npm run db:migrate
npm run seed
npm run dev                       # builds @cinema/shared, then tsx watch (API on :3000)
```

Frontend, in a second terminal:

```bash
cp packages/web/.env.example packages/web/.env   # VITE_API_URL, defaults to :3000
npm run dev:web                                   # Vite dev server on :5173
```

Open `http://localhost:5173` and log in with one of the seeded users above. The API's
`CORS_ORIGIN` (see below) must include `http://localhost:5173` for the browser to be
allowed to call it — it does by default.

To wipe all data (users, seats, reservations) without dropping the schema — e.g. to
start over with a clean slate — run `npm run db:clean`, then `npm run seed` again.

## Environment variables

**Server** — set in `packages/server/.env` (see `.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `JWT_SECRET` | — | Secret used to sign/verify auth JWTs |
| `PORT` | `3000` | HTTP port |
| `RESERVATION_TTL_MINUTES` | `15` | How long a hold stays `ACTIVE` before it's eligible for expiry |
| `SWEEP_INTERVAL_MS` | `60000` | How often the background sweeper reconciles expired holds |
| `RUN_MODE` | `server-with-sweep` | Which process(es) to start — see [Run modes](#run-modes) below. Overridden by `--mode=` |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated list of browser origins allowed to call the API |

**Web** — set in `packages/web/.env` (see `.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the API. Baked into the bundle at build time (Vite inlines `VITE_`-prefixed vars) |
| `VITE_POLL_INTERVAL_MS` | `15000` | How often (ms) the seat map and reservation list re-poll the API |

## Cinema layout

10 rows (`A`–`J`) of 10 seats + 3 rows (`K`–`M`) of 5 seats = **115 seats**. Seats are
addressed by id, e.g. `A-5`. The layout (rows, sizes, valid ids) is defined entirely in
code — [`layout.ts`](packages/shared/src/layout.ts) in `@cinema/shared` — the `seats`
table only stores the opaque id.

## Seat states

- **available** — free to reserve
- **reserved** — held by an active, unexpired reservation
- **booked** — permanently held by a completed reservation

## API

All endpoints except `/auth/login` require `Authorization: Bearer <token>`.

### `POST /auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123"}'
```

```json
{ "token": "<jwt>", "user": { "id": "...", "username": "alice" } }
```

### `GET /seats`

Returns all 115 seats with their current derived state (no writes happen on read — an
expired-but-not-yet-swept hold is simply shown as `available`).

```bash
curl http://localhost:3000/seats -H "Authorization: Bearer $TOKEN"
```

```json
{ "seats": [ { "id": "A-1", "state": "available" }, ... ] }
```

### `POST /reservations`

Places a 15-minute hold on the given seats. Validated against Rule 1 and Rule 2 (below)
and against live occupancy.

```bash
curl -X POST http://localhost:3000/reservations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"seatIds":["A-5","A-6","A-7"]}'
```

```json
{
  "reservation": {
    "id": "...",
    "status": "ACTIVE",
    "seatIds": ["A-5", "A-6", "A-7"],
    "createdAt": "...",
    "expiresAt": "...",
    "completedAt": null
  }
}
```

### `POST /reservations/:id/complete`

Completes an active, unexpired reservation you own — its seats become permanently
`booked`.

```bash
curl -X POST http://localhost:3000/reservations/$ID/complete \
  -H "Authorization: Bearer $TOKEN"
```

### `GET /reservations`

Lists the current user's reservations (past and present), with a status of
`ACTIVE` / `COMPLETED` / `EXPIRED`.

```bash
curl http://localhost:3000/reservations -H "Authorization: Bearer $TOKEN"
```

### Status codes

| Code | Meaning |
|---|---|
| 400 | Malformed request |
| 401 | Missing/invalid auth |
| 403 | Not the reservation's owner |
| 404 | Unknown reservation |
| 409 | Seat no longer available / reservation not active |
| 410 | Reservation already expired |
| 422 | Seating rule violation (Rule 1 or Rule 2) |

## Business rules

### Rule 1 — Consecutive seats, same row

All selected seats must share a row and form a consecutive run of seat numbers.

- Valid: `A: 5,6,7` · `B: 1,2`
- Invalid: `A: 5,7` (gap) · `C: 2,3,5` (gap) · seats spanning two rows

### Rule 2 — No isolated empty seat

A reservation can't leave a single empty seat trapped between two occupied seats
(occupied = reserved, booked, or newly selected). Edge seats — with only one neighbor —
are exempt.

- Valid: `# # * * . . . . . .`
- Invalid: `# # . * * . . . . .` (seat 3 is trapped between seats 2 and 4)

Rule 2 is evaluated against **live occupancy** at reservation time, since it depends on
what other users currently hold — it can't be checked before touching the database, the
way Rule 1 can.

## Concurrency guarantee

Two users racing for the same seat must resolve to exactly one success and the rest
conflicts — never two successes, never a corrupted database.

```
User A reserves A-5 -> 201 Success
User B reserves A-5 -> 409 Conflict
```

This is enforced at two layers:

1. **Row-level locking.** A reservation request only ever touches one row (Rule 1
   guarantees that), so `createReservation` opens a transaction and takes
   `SELECT ... FOR UPDATE` on every seat id in that row before reading occupancy or
   writing anything. Concurrent requests targeting the same row serialize on this lock.
2. **A partial unique index**, declared in the schema:

   ```sql
   CREATE UNIQUE INDEX uniq_active_seat ON reservation_seats (seat_id) WHERE active = true;
   ```

   This makes it physically impossible for two rows in `reservation_seats` to mark the
   same seat `active` at once — the database itself rejects it. The row lock above is
   what turns that "reject with a 500-level unique-violation" case into a clean, expected
   `409 Conflict`, but even if the lock were somehow bypassed, the index is the final
   backstop.

## Expiry model

Reservations expire 15 minutes after creation if not completed. To avoid every request
paying the cost of a global cleanup sweep, expiry is handled in three tiers:

1. **Reads never write.** `GET /seats` and `GET /reservations` compute display state by
   comparing `expires_at` to the current time — a hold that's technically expired but
   hasn't been swept yet is simply shown as `available` / `EXPIRED`.
2. **Creates release locally.** When a new reservation locks a row, if it finds stale
   `ACTIVE` holds on seats it wants, it flips just those (within the row it already
   locked) to `EXPIRED` before proceeding — no global scan.
3. **A background sweeper** runs on an interval (`SWEEP_INTERVAL_MS`, off the request
   path, started only when the server actually boots — not when the app is imported for
   tests) and bulk-marks all expired `ACTIVE` reservations `EXPIRED`, so dead rows don't
   accumulate indefinitely under the partial index.

## Run modes

`src/index.ts` can start the HTTP server, the background sweeper, or both, controlled by
a `--mode=` CLI flag (falls back to the `RUN_MODE` env var, then defaults to
`server-with-sweep`):

| Mode | Starts | Use case |
|---|---|---|
| `server-with-sweep` (default) | HTTP server + sweeper | Single-instance / local dev — everything in one process. |
| `server` | HTTP server only | Scaling the API horizontally — run N replicas without N redundant sweepers. |
| `sweep` | Sweeper only | Run exactly one sweeper instance alongside multiple `server`-mode replicas. |

```bash
npm start -- --mode=server     # local
node dist/index.js --mode=sweep

docker compose run --rm server --mode=server   # container
docker compose run --rm server --mode=sweep
```

The sweep is a plain `UPDATE ... WHERE status = 'ACTIVE' AND expires_at < now()`, so
running it from more than one instance is safe, just redundant — `sweep` mode exists to
avoid that redundancy at scale, not to prevent a correctness issue.

## Data model

See [`docs/ERD.md`](docs/ERD.md) for the full entity-relationship diagram.

- **users** — seeded accounts (bcrypt-hashed passwords)
- **seats** — the 115 seat ids (row/size data lives in code, not here)
- **reservations** — one row per hold/booking attempt, with lifecycle `ACTIVE` →
  `COMPLETED` | `EXPIRED`
- **reservation_seats** — join table between reservations and seats; `active` is the
  column the partial unique index guards


## Testing

```bash
npm test
```

Runs `@cinema/shared`'s tests (`domain/seating.ts`'s Rule 1/Rule 2 logic — the only
logic unit-tested today) followed by `@cinema/server`'s. Both the backend and the
frontend import these same rule functions from `@cinema/shared`, so this is the single
place that validation logic is verified.

Integration coverage (supertest driving the `app.ts` factory against a real or mocked
Postgres) is planned as a future addition, per the PRD.
