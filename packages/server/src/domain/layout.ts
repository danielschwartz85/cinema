/**
 * Static cinema layout. This is the single source of truth for rows, row
 * sizes, and seat ids — the `seats` table stores only opaque ids; every
 * other property (row label, seat number, row size) is derived here.
 *
 * Layout (per PRD): 10 rows x 10 seats + 3 rows x 5 seats = 115 seats.
 */

export interface RowSpec {
  label: string;
  size: number;
}

const LARGE_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']; // 10 seats each
const SMALL_ROWS = ['K', 'L', 'M']; // 5 seats each

export const ROWS: RowSpec[] = [
  ...LARGE_ROWS.map((label) => ({ label, size: 10 })),
  ...SMALL_ROWS.map((label) => ({ label, size: 5 })),
];

const ROW_SIZE_BY_LABEL = new Map<string, number>(ROWS.map((r) => [r.label, r.size]));

export const TOTAL_SEATS = ROWS.reduce((sum, r) => sum + r.size, 0); // 115

export function isValidRow(label: string): boolean {
  return ROW_SIZE_BY_LABEL.has(label);
}

export function getRowSize(label: string): number | undefined {
  return ROW_SIZE_BY_LABEL.get(label);
}

export function seatId(row: string, seatNumber: number): string {
  return `${row}-${seatNumber}`;
}

const  SEAT_ID_PATTERN = /^([A-Za-z]+)-(\d+)$/;

export interface ParsedSeat {
  /** Original seat id string (e.g., 'A-1') */
  id: string;
  /** Row label (e.g., 'A', 'B', 'C') */
  row: string;
  /** 1-based seat number within the row */
  seatNumber: number;
}

/**
 * Parses and validates a seat id against the layout. Returns null if the id
 * is malformed, the row doesn't exist, or the seat number is out of range —
 * callers should treat that as a 400/422, not attempt a DB lookup.
 */
export function parseSeatId(id: string): ParsedSeat | null {
  const match = SEAT_ID_PATTERN.exec(id);
  if (!match) return null;
  const row = match[1].toUpperCase();
  const seatNumber = Number(match[2]);
  const size = getRowSize(row);
  if (size === undefined) return null;
  if (!Number.isInteger(seatNumber) || seatNumber < 1 || seatNumber > size) return null;
  return { id: seatId(row, seatNumber), row, seatNumber };
}

/** All seat ids belonging to a row, in seat-number order (1..size). */
export function getRowSeatIds(row: string): string[] {
  const size = getRowSize(row);
  if (size === undefined) return [];
  return Array.from({ length: size }, (_, i) => seatId(row, i + 1));
}

/** All 115 seat ids in layout order — used for seeding. */
export function getAllSeatIds(): string[] {
  return ROWS.flatMap((r) => getRowSeatIds(r.label));
}
