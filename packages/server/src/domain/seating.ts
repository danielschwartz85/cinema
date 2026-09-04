/**
 * Business rules for seat selection (PRD "Business Rules" section).
 * No DB — callers supply parsed seats and, for Rule 2, the live occupancy of
 * the row. The only side effect is a console.warn on rule failure, for
 * visibility into why a request was rejected.
 */

import { getRowSize } from './layout';
import type { ParsedSeat } from './layout';

export type RuleResult = { valid: true } | { valid: false; reason: string };

const ok: RuleResult = { valid: true };
const fail = (reason: string): RuleResult => {
  console.warn(`[seating] rule violation: ${reason}`);
  return { valid: false, reason };
};

/**
 * Rule 1 — Consecutive Seats: all selected seats must be in the same row and
 * form a consecutive run of seat numbers (no gaps, no duplicates).
 */
export function checkRule1(seats: ParsedSeat[]): RuleResult {
  if (seats.length === 0) return fail('At least one seat must be selected.');

  const row = seats[0].row;
  if (!seats.every((s) => s.row === row)) {
    return fail('All selected seats must be in the same row.');
  }

  const numbers = seats.map((s) => s.seatNumber).sort((a, b) => a - b);
  const distinct = new Set(numbers);
  if (distinct.size !== numbers.length) {
    return fail('Duplicate seats in selection.');
  }

  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  if (max - min !== numbers.length - 1) {
    return fail('Selected seats must be consecutive.');
  }

  return ok;
}

/**
 * Rule 2 — No Isolated Empty Seat: applying the new selection must not leave
 * exactly one empty seat trapped between two occupied seats (occupied =
 * reserved, booked, or newly selected). Edge seats have only one neighbor and
 * are always allowed to be empty.
 *
 * `occupiedSeatNumbers` = seat numbers already held (active reservations or
 * completed bookings) in this row, EXCLUDING the seats being newly selected.
 */
export function checkRule2(
  row: string,
  occupiedSeatNumbers: Iterable<number>,
  selectedSeatNumbers: Iterable<number>
): RuleResult {
  const size = getRowSize(row);
  if (size === undefined) return fail(`Unknown row "${row}".`);

  const occupied = new Set<number>(occupiedSeatNumbers);
  for (const n of selectedSeatNumbers) occupied.add(n);

  for (let seatNumber = 1; seatNumber <= size; seatNumber++) {
    if (occupied.has(seatNumber)) continue; // this seat is occupied, not empty

    // An edge seat has only one real neighbor, so it can never be "trapped".
    // Only flag an empty seat with a real neighbor on BOTH sides that are
    // both occupied.
    const hasLeftNeighbor = seatNumber > 1;
    const hasRightNeighbor = seatNumber < size;
    if (
      hasLeftNeighbor &&
      hasRightNeighbor &&
      occupied.has(seatNumber - 1) &&
      occupied.has(seatNumber + 1)
    ) {
      return fail(
        `Seat ${row}-${seatNumber} would be left as an isolated empty seat between occupied seats.`
      );
    }
  }

  return ok;
}
