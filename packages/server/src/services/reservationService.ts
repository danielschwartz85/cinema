import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client';
import type { Db } from '../db/client';
import { reservationSeats, reservations, seats } from '../db/schema';
import { getRowSeatIds, parseSeatId } from '../domain/layout';
import type { ParsedSeat } from '../domain/layout';
import { checkRule1, checkRule2 } from '../domain/seating';
import { AppError } from '../types/AppError';
import { env } from '../config/env';

export type ReservationStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export interface ReservationView {
  id: string;
  status: ReservationStatus;
  seatIds: string[];
  createdAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
}

/** A hold "occupies" its seat if it's a completed booking, or an ACTIVE hold that hasn't hit expiresAt yet. */
function isLive(status: ReservationStatus, expiresAt: Date): boolean {
  if (status === 'COMPLETED') return true;
  if (status === 'ACTIVE') return expiresAt.getTime() > Date.now();
  return false;
}

/** Logs then throws an AppError, so every rejection is visible server-side (errorHandler stays silent for AppErrors). */
function reject(error: AppError, context?: Record<string, unknown>): never {
  console.warn(`[reservationService] ${error.statusCode} ${error.message}`, context ?? '');
  throw error;
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function releaseSeats(tx: Tx, reservationIds: string[]): Promise<void> {
  if (reservationIds.length === 0) return;
  await tx
    .update(reservationSeats)
    .set({ active: false })
    .where(inArray(reservationSeats.reservationId, reservationIds));
}

/**
 * Marks reservations EXPIRED and releases their seats. Callers must already
 * hold a lock precluding a concurrent write to these reservations —
 * createReservation and completeReservation both take a `FOR UPDATE` lock
 * earlier in the same transaction, which is what makes a plain id-based
 * UPDATE (no status precondition) safe here. The sweeper has no such lock,
 * so it does its own atomic find-and-update instead of calling this.
 */
async function expireReservations(tx: Tx, reservationIds: string[]): Promise<void> {
  if (reservationIds.length === 0) return;
  await tx.update(reservations).set({ status: 'EXPIRED' }).where(inArray(reservations.id, reservationIds));
  await releaseSeats(tx, reservationIds);
}

/**
 * Create a reservation for the given seat ids.
 *
 * Phase A (pure validation, no DB call) rejects malformed/unknown seats and
 * Rule 1 violations before a connection is ever acquired.
 * Phase B (one transaction) locks the target row, checks live occupancy and
 * Rule 2, releases any stale holds it finds *within that row* (never
 * globally — that's the sweeper's job), then inserts the new hold. The
 * partial unique index on reservation_seats is the final backstop.
 */
export async function createReservation(
  userId: string,
  seatIdsInput: unknown
): Promise<ReservationView> {
  // ---------- Phase A: pure validation, no DB ----------
  if (!Array.isArray(seatIdsInput) || seatIdsInput.length === 0) {
    reject(AppError.badRequest('seatIds must be a non-empty array of seat ids.'), { userId });
  }

  const parsed: ParsedSeat[] = [];
  for (const rawId of seatIdsInput) {
    if (typeof rawId !== 'string') {
      reject(AppError.badRequest('Each seat id must be a string.'), { userId, rawId });
    }
    const p = parseSeatId(rawId);
    if (!p) reject(AppError.unprocessable(`Unknown or malformed seat id "${rawId}".`), { userId, rawId });
    parsed.push(p);
  }

  const seenIds = new Set(parsed.map((p) => p.id));
  if (seenIds.size !== parsed.length) {
    reject(AppError.unprocessable('Duplicate seats in selection.'), { userId, seatIds: parsed.map((p) => p.id) });
  }

  const rule1 = checkRule1(parsed);
  if (!rule1.valid) reject(AppError.unprocessable(rule1.reason), { userId, seatIds: parsed.map((p) => p.id) });

  const row = parsed[0].row;
  const rowSeatIds = getRowSeatIds(row);
  const targetSeatIds = parsed.map((p) => p.id);
  const targetSeatNumbers = parsed.map((p) => p.seatNumber);

  // ---------- Phase B: one interactive transaction ----------
  try {
    return await db.transaction(async (tx) => {
      // 1. Row-scoped mutex: lock every seat in this row until COMMIT.
      await tx.select({ id: seats.id }).from(seats).where(inArray(seats.id, rowSeatIds)).for('update');

      // 2. Read active holds on this row's seats.
      const holds = await tx
        .select({
          seatId: reservationSeats.seatId,
          reservationId: reservationSeats.reservationId,
          status: reservations.status,
          expiresAt: reservations.expiresAt,
        })
        .from(reservationSeats)
        .innerJoin(reservations, eq(reservationSeats.reservationId, reservations.id))
        .where(and(inArray(reservationSeats.seatId, rowSeatIds), eq(reservationSeats.active, true)));

      const liveHolds = holds.filter((h) => isLive(h.status, h.expiresAt));
      const liveOccupiedSeatIds = new Set(liveHolds.map((h) => h.seatId));

      for (const seatId of targetSeatIds) {
        if (liveOccupiedSeatIds.has(seatId)) {
          reject(AppError.conflict(`Seat ${seatId} is no longer available.`), { userId, seatId });
        }
      }

      // 3. Rule 2 against live occupancy. Target seats are already proven
      // free above, so any hold touching them here is stale, not live.
      const occupiedSeatNumbers = liveHolds.map((h) => parseSeatId(h.seatId)!.seatNumber);
      const rule2 = checkRule2(row, occupiedSeatNumbers, targetSeatNumbers);
      if (!rule2.valid) reject(AppError.unprocessable(rule2.reason), { userId, row, targetSeatNumbers });

      // 4. Release stale holds found in this row — bounded to the row we
      // already locked, never a global sweep.
      const staleReservationIds = [
        ...new Set(holds.filter((h) => !isLive(h.status, h.expiresAt)).map((h) => h.reservationId)),
      ];
      await expireReservations(tx, staleReservationIds);

      // 5. Create the new hold.
      const expiresAt = new Date(Date.now() + env.RESERVATION_TTL_MINUTES * 60_000);
      const [reservation] = await tx.insert(reservations).values({ userId, expiresAt }).returning();

      // 6. Claim the seats. The partial unique index is the final backstop
      // against a race not caught above.
      await tx
        .insert(reservationSeats)
        .values(targetSeatIds.map((seatId) => ({ reservationId: reservation.id, seatId, active: true })));

      return {
        id: reservation.id,
        status: reservation.status,
        seatIds: targetSeatIds,
        createdAt: reservation.createdAt,
        expiresAt: reservation.expiresAt,
        completedAt: reservation.completedAt,
      };
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Postgres unique_violation on the partial index -> lost a last-instant race.
    if ((err as { code?: string }).code === '23505') {
      reject(AppError.conflict('One or more selected seats were just taken.'), { userId, seatIds: targetSeatIds });
    }
    throw err;
  }
}

/**
 * Complete an ACTIVE reservation owned by `userId`. If it turns out to have
 * already expired (but the sweeper hasn't touched it yet), this reconciles
 * that one reservation on the way to a 410 — scoped to a single row, not a
 * global sweep.
 */
export async function completeReservation(
  userId: string,
  reservationId: string
): Promise<ReservationView> {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .for('update');

    if (!reservation) reject(AppError.notFound('Reservation not found.'), { userId, reservationId });
    if (reservation.userId !== userId) {
      reject(AppError.forbidden('You do not own this reservation.'), {
        userId,
        reservationId,
        ownerId: reservation.userId,
      });
    }
    if (reservation.status === 'COMPLETED') {
      reject(AppError.conflict('Reservation is already completed.'), { userId, reservationId });
    }

    const isExpired =
      reservation.status === 'EXPIRED' || reservation.expiresAt.getTime() <= Date.now();
    if (isExpired) {
      if (reservation.status === 'ACTIVE') {
        await expireReservations(tx, [reservationId]);
      }
      reject(AppError.gone('Reservation has expired.'), { userId, reservationId });
    }

    const [updated] = await tx
      .update(reservations)
      .set({ status: 'COMPLETED', completedAt: new Date() })
      .where(eq(reservations.id, reservationId))
      .returning();

    const seatRows = await tx
      .select({ seatId: reservationSeats.seatId })
      .from(reservationSeats)
      .where(eq(reservationSeats.reservationId, reservationId));

    return {
      id: updated.id,
      status: updated.status,
      seatIds: seatRows.map((s) => s.seatId),
      createdAt: updated.createdAt,
      expiresAt: updated.expiresAt,
      completedAt: updated.completedAt,
    };
  });
}

/** Read-only: displays an unswept-but-expired ACTIVE reservation as EXPIRED, without writing. */
export async function listUserReservations(userId: string): Promise<ReservationView[]> {
  const rows = await db
    .select({
      reservationId: reservations.id,
      status: reservations.status,
      createdAt: reservations.createdAt,
      expiresAt: reservations.expiresAt,
      completedAt: reservations.completedAt,
      seatId: reservationSeats.seatId,
    })
    .from(reservations)
    .leftJoin(reservationSeats, eq(reservationSeats.reservationId, reservations.id))
    .where(eq(reservations.userId, userId));

  const byId = new Map<string, ReservationView>();
  for (const row of rows) {
    let view = byId.get(row.reservationId);
    if (!view) {
      const displayStatus: ReservationStatus =
        row.status === 'ACTIVE' && row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : row.status;
      view = {
        id: row.reservationId,
        status: displayStatus,
        seatIds: [],
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        completedAt: row.completedAt,
      };
      byId.set(row.reservationId, view);
    }
    if (row.seatId) view.seatIds.push(row.seatId);
  }

  return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Background sweeper — the only global expiry operation, off the request
 * path. Bulk-flips overdue ACTIVE reservations to EXPIRED and releases their
 * seats so dead rows don't accumulate and GET /reservations reflects EXPIRED
 * even for holds nobody has touched since.
 */
export async function sweepExpiredReservations(): Promise<number> {
  return db.transaction(async (tx) => {
    // Atomic find-and-update (no prior lock, so the status precondition must
    // stay in the same statement as the write — see expireReservations above).
    const expired = await tx
      .update(reservations)
      .set({ status: 'EXPIRED' })
      .where(and(eq(reservations.status, 'ACTIVE'), lt(reservations.expiresAt, new Date())))
      .returning({ id: reservations.id });

    await releaseSeats(
      tx,
      expired.map((r) => r.id)
    );

    if (expired.length > 0) {
      console.log(`[sweeper] expired ${expired.length} reservation(s): ${expired.map((r) => r.id).join(', ')}`);
    }

    return expired.length;
  });
}
