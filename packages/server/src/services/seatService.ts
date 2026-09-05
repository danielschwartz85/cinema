import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { reservationSeats, reservations, seats } from '../db/schema';
import { getAllSeatIds } from '@cinema/shared';

export type SeatState = 'available' | 'reserved' | 'booked';

export interface SeatView {
  id: string;
  state: SeatState;
}

/**
 * Read-only seat listing. No writes: a stale ACTIVE hold whose expiresAt has
 * passed but hasn't been swept yet is simply displayed as `available` —
 * expiry is reconciled physically elsewhere (create's row-local release, or
 * the background sweeper), never here.
 */
export async function listSeats(): Promise<SeatView[]> {
  const rows = await db
    .select({
      seatId: seats.id,
      status: reservations.status,
      expiresAt: reservations.expiresAt,
    })
    .from(seats)
    .leftJoin(
      reservationSeats,
      and(eq(reservationSeats.seatId, seats.id), eq(reservationSeats.active, true))
    )
    .leftJoin(reservations, eq(reservationSeats.reservationId, reservations.id));

  const now = Date.now();
  const stateBySeat = new Map<string, SeatState>();
  for (const row of rows) {
    let state: SeatState = 'available';
    if (row.status === 'COMPLETED') {
      state = 'booked';
    } else if (row.status === 'ACTIVE' && row.expiresAt !== null && row.expiresAt.getTime() > now) {
      state = 'reserved';
    }
    stateBySeat.set(row.seatId, state);
  }

  // Return in layout order, not DB row order.
  return getAllSeatIds().map((id) => ({ id, state: stateBySeat.get(id) ?? 'available' }));
}
