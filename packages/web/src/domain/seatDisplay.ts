import { getRowSize, parseSeatId } from '@cinema/shared';
import type { Reservation, Seat, SeatState } from '../api/types';

export type SeatDisplayStatus =
  | 'available'
  | 'available-isolated'
  | 'selected'
  | 'mine-reserved'
  | 'mine-booked'
  | 'reserved'
  | 'booked';

export interface SeatDisplay {
  id: string;
  state: SeatState;
  status: SeatDisplayStatus;
  /** Whether the seat currently responds to a click (toggle available/selected). */
  clickable: boolean;
}

interface DisplayContext {
  selectedSet: ReadonlySet<string>;
  mineReservedSeats: ReadonlySet<string>;
  mineBookedSeats: ReadonlySet<string>;
  occupiedNumbersByRow: ReadonlyMap<string, ReadonlySet<number>>;
}

/**
 * A seat "already occupied" (reserved or booked by anyone, current selection
 * aside) is isolated if it sits between two occupied seats — same edge-aware
 * rule as the server's Rule 2 (`checkRule2` in @cinema/shared), applied here
 * against live occupancy rather than a pending selection.
 */
function isSeatIsolated(seatId: string, occupiedNumbersByRow: DisplayContext['occupiedNumbersByRow']): boolean {
  const parsed = parseSeatId(seatId);
  if (!parsed) return false;
  const size = getRowSize(parsed.row);
  if (size === undefined) return false;
  const occupied = occupiedNumbersByRow.get(parsed.row);
  if (!occupied) return false;

  const hasLeftNeighbor = parsed.seatNumber > 1;
  const hasRightNeighbor = parsed.seatNumber < size;
  return (
    hasLeftNeighbor &&
    hasRightNeighbor &&
    occupied.has(parsed.seatNumber - 1) &&
    occupied.has(parsed.seatNumber + 1)
  );
}

function deriveSeatDisplay(seat: Seat, ctx: DisplayContext): SeatDisplay {
  if (seat.state === 'reserved') {
    const mine = ctx.mineReservedSeats.has(seat.id);
    return { id: seat.id, state: seat.state, status: mine ? 'mine-reserved' : 'reserved', clickable: false };
  }

  if (seat.state === 'booked') {
    const mine = ctx.mineBookedSeats.has(seat.id);
    return { id: seat.id, state: seat.state, status: mine ? 'mine-booked' : 'booked', clickable: false };
  }

  // seat.state === 'available'

  // available selected by the user
  if (ctx.selectedSet.has(seat.id)) {
    return { id: seat.id, state: seat.state, status: 'selected', clickable: true };
  }

  // available-isolated or available-regular (not isolated)
  const isolated = isSeatIsolated(seat.id, ctx.occupiedNumbersByRow);
  return {
    id: seat.id,
    state: seat.state,
    status: isolated ? 'available-isolated' : 'available',
    clickable: !isolated,
  };
}

/** Builds a `seatId -> SeatDisplay` map from live seats, the user's own reservations, and the current selection. */
export function buildSeatDisplayMap(
  seats: Seat[],
  reservations: Reservation[],
  selection: readonly string[]
): Map<string, SeatDisplay> {
  // build a set of the currently selected seat IDs
  const selectedSet = new Set(selection);

  // build sets of the user's own reserved and booked seats
  const mineReservedSeats = new Set<string>();
  const mineBookedSeats = new Set<string>();
  for (const reservation of reservations) {
    if (reservation.status === 'ACTIVE') {
      for (const id of reservation.seatIds) mineReservedSeats.add(id);
    } else if (reservation.status === 'COMPLETED') {
      for (const id of reservation.seatIds) mineBookedSeats.add(id);
    }
  }

  // build a map of occupied seat numbers by row
  const occupiedNumbersByRow = new Map<string, Set<number>>();
  for (const seat of seats) {
    if (seat.state === 'available') continue;
    const parsed = parseSeatId(seat.id);
    if (!parsed) continue;
    let numbers = occupiedNumbersByRow.get(parsed.row);
    if (!numbers) {
      numbers = new Set();
      occupiedNumbersByRow.set(parsed.row, numbers);
    }
    numbers.add(parsed.seatNumber);
  }

  const ctx: DisplayContext = { selectedSet, mineReservedSeats, mineBookedSeats, occupiedNumbersByRow };

  const result = new Map<string, SeatDisplay>();
  for (const seat of seats) result.set(seat.id, deriveSeatDisplay(seat, ctx));
  return result;
}
